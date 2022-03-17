const { NotFoundError, DataConflictError, ValidationError, NotAllowedError } = require('../ErrorHandling/Exceptions');
const { SeverityLevel } = require('applicationinsights/out/Declarations/Contracts');
const ActivityManagerService = require('./ActivityManagerService');
const loadboardClasses = require('../Loadboards/LoadboardsList');
const LoadboardContact = require('../Models/LoadboardContact');
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const LoadboardRequest = require('../Models/LoadboardRequest');
const { AppResponse } = require('../ErrorHandling/Responses');
const LoadboardsApi = require('../Loadboards/LoadboardsApi');
const { ServiceBusClient } = require('@azure/service-bus');
const LoadboardPost = require('../Models/LoadboardPost');
const OrderStopLink = require('../Models/OrderStopLink');
const telemetry = require('../ErrorHandling/Insights');
const InvoiceBill = require('../Models/InvoiceBill');
const emitter = require('../EventListeners/index');
const PubSubService = require('./PubSubService');
const Loadboard = require('../Models/Loadboard');
const SFAccount = require('../Models/SFAccount');
const SFContact = require('../Models/SFContact');
const OrderStop = require('../Models/OrderStop');
const OrderJob = require('../Models/OrderJob');
const BillService = require('./BIllService');
const { DateTime } = require('luxon');
const R = require('ramda');

const connectionString = process.env.AZURE_SERVICEBUS_CONNECTIONSTRING;
const queueName = 'loadboard_posts_outgoing';
const SYSUSER = process.env.SYSTEM_USER;

const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(queueName);

const dispatchableLoadboards = ['SUPERDISPATCH', 'SHIPCARS'];
let dbLoadboardNames;

(async function ()
{
    dbLoadboardNames = (await Loadboard.query()).reduce((acc, curr) => (acc[curr.name] = curr, acc), {});
})();

class LoadboardService
{
    /**
     * @description Retrieves all the existing loadboard posts for a job and adds all the missing
     * potential loadboard posts as nulled out posts
     * @param {UUID} jobGuid
     * @returns {Object} An object with all the loadboard posts with the loadboardname being the key
     * and the post being the value
     */
    static async getAllAndMissingPosts(jobGuid)
    {
        // reducing all the loadboards into a string array
        const allLoadboardNames = (Object.keys(dbLoadboardNames)).map(key => key);
        const posts = await this.getLoadboardPosts(jobGuid, allLoadboardNames);
        for (const lb of allLoadboardNames)
        {
            if (!(lb in posts))
            {
                posts[lb] = LoadboardPost.getEmptyPost(jobGuid, lb);
            }
        }

        return posts;
    }

    /**
     * Gets either all the loadboard posts for a job, or the loadboard posts for the
     * loadboards specified in the loadboardNames array.
     * @param {UUID} jobGuid
     * @param {Array<string>} loadboardNames
     * @returns Object with a jobs loadboard posts with the keys being the loadboard name
     * and the values being the loadboard posts
     */
    static async getLoadboardPosts(jobGuid, loadboardNames = [])
    {
        const jobQuery = OrderJob.query().select('orderJobs.guid').findById(jobGuid);
        let job;
        if (R.isEmpty(loadboardNames))
        {
            job = await jobQuery.withGraphJoined('loadboardPosts');
        }
        else
        {
            job = await jobQuery.withGraphJoined('loadboardPosts(getExistingFromList)')
                .findById(jobGuid).modifiers({
                    getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
                });
        }

        if (!job)
            throw new NotFoundError('Job not found');

        const posts = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});

        return posts;
    }

    static async createPostings(jobId, posts, currentUser)
    {
        const job = await LoadboardService.getAllPostingData(jobId, posts, currentUser);
        const payloads = [];
        let lbPayload;

        for (const post of posts)
        {
            // to prevent creating multiples of the same loads, check if the posting already
            // has an external guid. If it does and it alreadys exists, skip it.
            if (job.postObjects[`${post.loadboard}`].externalGuid == null)
            {
                lbPayload = new loadboardClasses[`${post.loadboard}`](job);
                payloads.push(lbPayload['create']());
            }
        }

        // sending all payloads as one big object so one big response can be returned
        // and handler can then use one big transaction to update all records rather
        // than have a single new transaction for each posting
        await sender.sendMessages({ body: payloads });
    }

    static async postPostings(jobId, posts, currentUser)
    {
        const dispatches = await OrderJobDispatch.query()
            .where({ 'rcgTms.orderJobDispatches.jobGuid': jobId }).andWhere(builder =>
            {
                builder.where({ isAccepted: true }).orWhere({ isPending: true });
            }).first();

        if (dispatches)
            throw new DataConflictError('Cannot post load with active dispatch offers');

        const job = await LoadboardService.getAllPostingData(jobId, posts, currentUser);
        const payloads = [];
        let lbPayload;

        for (const post of posts)
        {
            lbPayload = new loadboardClasses[`${post.loadboard}`](job);
            payloads.push(lbPayload['post']());
        }

        // sending all payloads as one big object so one big response can be returned
        // and handler can then use one big transaction to update all records rather
        // than have a single new transaction for each posting
        if (payloads.length != 0)
        {
            await sender.sendMessages({ body: payloads });
            LoadboardService.registerLoadboardStatusManager(posts, job.orderGuid, currentUser, 2, jobId);
        }
    }

    static async unpostPostings(jobId, posts, currentUser)
    {
        const job = await LoadboardService.getPostRecords(jobId, posts);
        const payloads = [];
        let lbPayload;

        for (const lbName of Object.keys(job.postObjects))
        {
            lbPayload = new loadboardClasses[`${lbName}`](job);
            payloads.push(lbPayload['unpost']());
        }

        // sending all payloads as one big object so one big response can be returned
        // and handler can then use one big transaction to update all records rather
        // than have a single new transaction for each posting
        if (payloads.length != 0)
        {
            await sender.sendMessages({ body: payloads });
            LoadboardService.registerLoadboardStatusManager(posts, job.orderGuid, currentUser, 3, jobId);
        }
    }

    static async updatePostings(jobId)
    {
        const job = await LoadboardService.getjobDataForUpdate(jobId);

        const payloads = [];
        let lbPayload;

        for (const post of job.loadboardPosts)
        {
            lbPayload = new loadboardClasses[`${post.loadboard}`](job);
            payloads.push(lbPayload['update']());
        }

        if (payloads.length != 0)
            await sender.sendMessages({ body: payloads });

        return payloads;
    }

    static async dispatchJob(jobId, body, currentUser)
    {
        const trx = await OrderJobDispatch.startTransaction();
        const allPromises = [];

        try
        {
            if (body.loadboard != null && !dispatchableLoadboards.includes(body.loadboard))
                throw new ValidationError(`${body.loadboard} cannot be dispatched to, you can only dispatch to ${dispatchableLoadboards}`);

            let job = {};

            // if dispatching internally, no need to worry about making sure the load is in
            // another loadboard, otherwise first create a posting record and dispatch
            if (!body.loadboard)
            {
                job = await OrderJob.query(trx).findById(jobId).withGraphFetched('[stops(distinct), commodities(distinct, isNotDeleted), bills, dispatches(activeDispatch), type, order]');

                if (!job)
                {
                    throw new NotFoundError('Job not found');
                }

                const stops = await this.getFirstAndLastStops(job.stops);

                Object.assign(job, stops);
            }
            else
            {
                job = await this.getAllPostingData(jobId, [{ loadboard: body.loadboard }], currentUser);

                // check dispatch table for any active dispatching
                job.dispatches = await OrderJobDispatch.query(trx).where({ jobGuid: jobId }).modify('activeDispatch');
            }

            job.validateJobForDispatch();

            const carrier = await SFAccount.query(trx).modify('byId', body.carrier.guid).modify('carrier').first();
            const driver = body.driver;

            if (!carrier)
                throw new NotFoundError('carrier not found, please pass in a valid guid, salesforce id, or dot number');
            else if (carrier.status == 'Inactive' || carrier.status == 'Blacklist' || carrier.blaclist == true)
                throw new DataConflictError(`Carrier has a status of ${carrier.status} and cannot be dispatched to without manager approval`);

            let carrierContact = driver.guid == null ? driver : await SFContact.query().modify('byId', driver.guid).first();

            // first check if the contact exists based off guid that was passed in
            if (!carrierContact?.guid)
            {
                carrierContact = SFContact.fromJson({
                    name: driver.name,
                    email: driver.email,
                    phoneNumber: driver.phoneNumber
                });
                carrierContact.accountId = carrier.sfId;
                carrierContact = await SFContact.query(trx).insertAndFetch(carrierContact);
            }
            else
            {
                if (carrierContact.accountId != carrier.sfId)
                    throw new ValidationError('Please pass in valid driver for carrier');
            }

            // updating invoice bills with proper payments methods
            await InvoiceBill.query(trx).patch({ paymentTermId: body.paymentTerm, updatedByGuid: currentUser }).findById(job?.bills[0]?.guid);

            // evenly split a price across provided commodities
            const lines = BillService.splitCarrierPay(job.bills[0], job.commodities, body.price, currentUser);
            for (const line of lines)
                line.transacting(trx);

            allPromises.push(...lines);

            // update scheduled dates on stops
            job.pickup.setScheduledDates(body.pickup.dateType, body.pickup.startDate, body.pickup.endDate);
            job.pickup.setUpdatedBy(currentUser);
            allPromises.push(OrderStop.query(trx).patch(job.pickup).findById(job.pickup.guid));

            job.delivery.setScheduledDates(body.delivery.dateType, body.delivery.startDate, body.delivery.endDate);
            job.delivery.setUpdatedBy(currentUser);
            allPromises.push(OrderStop.query(trx).patch(job.delivery).findById(job.delivery.guid));

            // validating that pick date is before delivery
            if (job.delivery.dateScheduledStart < job.pickup.dateScheduledStart || job.delivery.dateScheduledEnd < job.pickup.dateScheduledEnd)
            {
                throw new ValidationError('Pickup dates should be before delivery date');
            }

            // update job status to pending and started date
            const jobForUpdate = OrderJob.fromJson({
                dateStarted: DateTime.utc(),
                status: OrderJob.STATUS.PENDING
            });

            jobForUpdate.setUpdatedBy(currentUser);

            allPromises.push(OrderJob.query(trx).patch(jobForUpdate).findById(job.guid));

            let lbPost;
            try
            {
                lbPost = body.loadboard == null ? null : job.postObjects[`${body.loadboard}`].guid;
            }
            catch (e)
            {
                throw new DataConflictError(`Loadboard Post for ${body.loadboard} is out of sync. Please fix the job and the resync the loadboard post before dispatching`);
            }

            // composing dispatch object
            const dispatch = OrderJobDispatch.fromJson({
                jobGuid: job.guid,
                loadboardPostGuid: lbPost,
                vendorGuid: carrier.guid,
                vendorAgentGuid: carrierContact.guid,
                externalGuid: null,
                isValid: true,
                isPending: true,
                isAccepted: false,
                isDeclined: false,
                isCanceled: false,
                paymentTermId: body.paymentTerm,
                paymentMethodId: body.paymentMethod,
                price: body.price
            });

            dispatch.setCreatedBy(currentUser);

            job.dispatch = await OrderJobDispatch.query(trx).insertAndFetch(dispatch);

            let message = {};
            if (lbPost)
            {
                // assigning the vendor to the job because we need it for
                // creating loadboard messages
                job.vendor = carrier;
                const lbPayload = new loadboardClasses[`${body.loadboard}`](job);
                message = [lbPayload['dispatch']()];

                await sender.sendMessages({ body: message });
            }

            // this grabs all the loadboard posts that are posted excluding the loadboard
            // that is being to dispatched to now because that loadboard post is now out of sync
            // until the job is completely dispatched and a successful response is returned
            const posts = await LoadboardPost.query(trx).select('loadboard').where({ status: 'posted', isPosted: true, isSynced: true, jobGuid: jobId });

            await LoadboardService.unpostPostings(jobId, posts, currentUser);

            // compose response that can be useful for client
            dispatch.vendor = carrier;
            dispatch.vendorAgent = carrierContact;
            dispatch.pickup = {
                dateScheduledType: job.pickup.dateScheduledType,
                dateScheduledStart: job.pickup.dateScheduledStart,
                dateScheduledEnd: job.pickup.dateScheduledEnd
            };
            dispatch.delivery = {
                dateScheduledType: job.delivery.dateScheduledType,
                dateScheduledStart: job.delivery.dateScheduledStart,
                dateScheduledEnd: job.delivery.dateScheduledEnd
            };

            await Promise.all(allPromises);
            await trx.commit();

            // since there is no loadboard to dispatch to, we can write the status log right away
            if (!lbPost)
            {
                await ActivityManagerService.createActivityLog({
                    orderGuid: job.orderGuid,
                    userGuid: currentUser,
                    activityId: 10,
                    jobGuid: jobId,
                    extraAnnotations: {
                        loadboard: 'TRUKT',
                        code: 'pending',
                        vendorGuid: dispatch.vendor.guid,
                        vendorAgentGuid: dispatch.vendorAgentGuid,
                        vendorName: dispatch.vendor.name,
                        vendorAgentName: dispatch.vendorAgent.name,
                        dotNumber: dispatch.vendor.dotNumber
                    }
                });

                emitter.emit('orderjob_dispatch_offer_sent', { jobGuid: jobId });
            }

            dispatch.jobStatus = OrderJob.STATUS.PENDING;
            return dispatch;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    static async cancelDispatch(jobGuid, currentUser)
    {
        const trx = await OrderJobDispatch.startTransaction();

        try
        {
            // get the dispatch for the current job with vendor info
            const dispatch = await OrderJobDispatch.query()
                .select('rcgTms.orderJobDispatches.guid',
                    'rcgTms.orderJobDispatches.jobGuid',
                    'isAccepted',
                    'isPending',
                    'isCanceled',
                    'isDeclined',
                    'loadboardPostGuid',
                    'rcgTms.orderJobDispatches.externalGuid')
                .withGraphJoined('[loadboardPost, job, vendor, vendorAgent]')
                .findOne({ 'rcgTms.orderJobDispatches.jobGuid': jobGuid })
                .andWhere(builder =>
                {
                    builder.where({ isAccepted: true }).orWhere({ isPending: true }).where({ isValid: true });
                })
                .modifyGraph('job', builder => builder.select('rcgTms.orderJobs.guid', 'orderGuid'))
                .modifyGraph('vendor', builder => builder.select('name', 'salesforce.accounts.guid'))
                .modifyGraph('vendorAgent', builder => builder.select('name', 'salesforce.contacts.guid'));

            if (!dispatch)
                throw new DataConflictError('No active offers to undispatch');

            // this is temporary fix, should make it data driven eventually
            if ([OrderJob.STATUS.PICKED_UP, OrderJob.STATUS.DELIVERED, OrderJob.STATUS.COMPLETED].includes(dispatch.job.status))
                throw new DataConflictError('Can not cancel dispatch for a job that has already been picked up or delivered');

            // assign current user as updated by
            dispatch.setUpdatedBy(currentUser);

            // if dispatched has loadboard post guid
            if (dispatch.loadboardPostGuid != null)
            {
                // getting all posting related to the job
                const job = await this.getAllPostingData(jobGuid, [{ loadboard: dispatch.loadboardPost.loadboard }], currentUser);

                // updating new disptach to job
                job.dispatch = dispatch;

                // composing new loadboard payload
                const lbPayload = new loadboardClasses[`${dispatch.loadboardPost.loadboard}`](job);

                // sending undisptach message to loadboards
                const message = [lbPayload['undispatch']()];

                // send message to bus que to unpost order
                await sender.sendMessages({ body: message });
            }
            else
            {
                // setting disptch to canceled status
                dispatch.setToCanceled(currentUser);

                // updating dispatch object to canceled
                await OrderJobDispatch.query(trx).patch(dispatch).findById(dispatch.guid);

                // setting all stop related to job to null
                await OrderStop.query(trx)
                    .patch({ dateScheduledStart: null, dateScheduledEnd: null, dateScheduledType: null, updatedByGuid: currentUser })
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid')
                            .where({ 'jobGuid': jobGuid })
                            .distinctOn('stopGuid')
                    );

                // creating new job object with no vedor because we are removing them.
                const job = OrderJob.fromJson({
                    vendorGuid: null,
                    vendorAgentGuid: null,
                    vendorContact: null,
                    dateStarted: null,
                    status: OrderJob.STATUS.READY
                });

                job.setUpdatedBy(currentUser);

                // updating orderJob with new fields
                await OrderJob.query(trx).patch(job).findById(dispatch.jobGuid);

                // returning ready status if sucessfull
                dispatch.jobStatus = job.status;
            }

            // commiting transaction
            await trx.commit();

            // due to the nature of the code, we have to write redundant code to handle edge cases xD
            if (!dispatch.loadboardPostGuid)
            {
                // updating activity logger
                await ActivityManagerService.createActivityLog({
                    orderGuid: dispatch.job.orderGuid,
                    userGuid: currentUser,
                    activityId: 12,
                    jobGuid,
                    extraAnnotations: {
                        loadboard: 'TRUKT',
                        code: 'ready',
                        vendorGuid: dispatch.vendor.guid,
                        vendorAgentGuid: dispatch.vendorAgentGuid,
                        vendorName: dispatch.vendor.name,
                        vendorAgentName: dispatch.vendorAgent.name,
                        dotNumber: dispatch.vendor.dotNumber
                    }
                });

                emitter.emit('orderjob_dispatch_offer_canceled', { jobGuid });
            }

            return dispatch;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    static async acceptDispatch(jobGuid, currentUser)
    {
        const trx = await OrderJobDispatch.startTransaction();
        const allPromises = [];

        // TODO: combine this logic with Loadboard handleCarrierAcceptDispatch... it is the same thing. this is terrible design.
        try
        {
            const [job, orderStops] = await Promise.all([
                OrderJob.query(trx).findById(jobGuid)
                    .select([
                        OrderJob.ref('*'),
                        OrderJob.relatedQuery('dispatches').where({
                            isValid: true,
                            isPending: true
                        }).count().as('validDispatchesCount')
                    ]).withGraphJoined('order'),
                OrderJob.relatedQuery('stops').for(jobGuid)
                    .withGraphJoined('terminal')
                    .whereNotNull('rcgTms.orderStopLinks.orderGuid')
                    .distinctOn('rcgTms.orderStops.guid')
            ]);
            const order = job.order;
            if (!job)
                throw new NotFoundError('Job not found');

            job.validateJobForAccepting();

            const dispatch = await job.$relatedQuery('dispatches', trx)
                .findOne({ 'orderJobDispatches.jobGuid': jobGuid, isPending: true, isValid: true })
                .withGraphFetched('[vendor, vendorAgent, loadboardPost]');

            if (!dispatch)
                throw new NotFoundError(404, 'Dispatch not found');

            const lbPayload = [];
            if (dispatch.loadboardPost?.loadboard == 'SHIPCARS')
            {
                throw new DataConflictError('Cannot manually accept job that was dispatched to Ship.Cars');
            }
            else if (dispatch.loadboardPost?.loadboard == 'SUPERDISPATCH')
            {
                const lb = new loadboardClasses[`${dispatch.loadboardPost.loadboard}`](dispatch);
                lbPayload.push(lb.manuallyAcceptDispatch());
            }

            allPromises.push(dispatch.$relatedQuery('loadboardPost', trx).patch({ isPosted: false }));

            dispatch.setToAccepted();
            dispatch.setUpdatedBy(currentUser);

            allPromises.push(dispatch.$query(trx).patch());

            allPromises.push(job.$query(trx).patch({
                vendorGuid: dispatch.vendor.guid,
                vendorContactGuid: dispatch.vendorContactGuid,
                vendorAgentGuid: dispatch.vendorAgent.guid,
                status: OrderJob.STATUS.DISPATCHED,
                updatedByGuid: currentUser
            }));

            const jobBill = await dispatch.$query(trx)
                .joinRelated('job.bills')
                .select('job:bills.*', 'job.isTransport')
                .where({ 'job.isTransport': true });

            allPromises.push(
                InvoiceBill.query(trx).patch({
                    paymentTermId: dispatch.paymentTermId,
                    paymentMethodId: dispatch.paymentMethodId,
                    consigneeGuid: dispatch.vendorGuid
                }).findById(jobBill.guid)
            );

            allPromises.push(OrderJobDispatch.query(trx).patch({ isValid: false })
                .where({ jobGuid: dispatch.jobGuid }).andWhereNot({ guid: dispatch.guid }));

            await Promise.all([...allPromises, sender.sendMessages({ body: lbPayload })]);
            await trx.commit();
            dispatch.status = OrderJob.STATUS.DISPATCHED;

            await ActivityManagerService.createActivityLog({
                orderGuid: job.orderGuid,
                userGuid: currentUser,
                activityId: 11,
                jobGuid: job.guid,
                extraAnnotations: {
                    loadboard: dispatch.loadboardPost?.loadboard || 'TRUKT',
                    vendorGuid: dispatch.vendor?.guid,
                    vendorAgentGuid: dispatch.vendorAgent?.guid,
                    vendorName: dispatch.vendor?.name,
                    vendorAgentName: dispatch.vendorAgent?.name,
                    dotNumber: dispatch.vendor?.dotNumber
                }
            });

            emitter.emit('orderjob_dispatch_offer_accepted', { jobGuid: job.guid, currentUser });

            for (const stop of orderStops)
            {
                if (stop.isDelivery && stop.dateScheduledStart != undefined)
                {
                    emitter.emit('order_stop_delivery_scheduled', { order, job, stop, datetime: stop.dateScheduledStart });
                }
            }

            return dispatch;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    // This method gets all the job information and creates new post records based on the posts
    // list that is sent in if needed
    static async getAllPostingData(jobId, posts, currentUser)
    {
        const loadboardNames = posts.map((post) => { return post.loadboard; });
        const job = await OrderJob.query().findById(jobId).withGraphFetched(`[
            commodities(distinct, isNotDeleted).[vehicle, commType],
            order.[client, clientContact, dispatcher, invoices.lines(isNotDeleted, transportOnly).item],
            stops(distinct).[primaryContact, terminal], 
            loadboardPosts(getExistingFromList),
            equipmentType, 
            bills.lines(isNotDeleted, transportOnly).item,
            dispatcher, type
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        if (!job)
            throw new NotFoundError('Job not found');

        if (job.isOnHold)
            throw new DataConflictError('Cannot get posting data for job that is on hold');

        await this.createPostRecords(job, posts, currentUser);

        if (job.order.invoices.length != 0)
            this.combineCommoditiesWithLines(job.commodities, job.order.invoices[0], 'invoice');

        if (job.bills.length != 0)
            this.combineCommoditiesWithLines(job.commodities, job.bills[0], 'bill');

        const stops = await this.getFirstAndLastStops(job.stops);
        Object.assign(job, stops);

        delete job.stops;

        return job;
    }

    // this gets the jobs post records that are passed in the posts paramate
    /**
     *
     * @param {*} jobId guid of the job
     * @param {*} posts an array of objects i.e [{"loadboard": "SHIPCARS"}]
     * @returns a job with its posts
     */
    static async getPostRecords(jobId, posts)
    {
        const loadboardNames = posts.map((post) => { return post.loadboard; });

        const job = await OrderJob.query().findById(jobId).withGraphFetched(`[
            loadboardPosts(getExistingFromList, getPosted)
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        if (!job)
            throw new NotFoundError('Job not found');

        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});

        delete job.loadboardPosts;

        return job;
    }

    // This method is for getting all existing data for the job
    static async getjobDataForUpdate(jobId)
    {
        const job = await OrderJob.query().findById(jobId).withGraphFetched(`[
            commodities(distinct, isNotDeleted).[vehicle, commType], 
            order.[client, clientContact, invoices.lines(transportOnly).item],
            stops(distinct).[primaryContact, terminal], 
            loadboardPosts(getExistingFromList),
            equipmentType, 
            bills.lines(isNotDeleted, transportOnly).item,
            dispatcher
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getValid')
        });

        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});
        const stops = await this.getFirstAndLastStops(job.stops);

        if (job.order.invoices.length != 0)
            this.combineCommoditiesWithLines(job.commodities, job.order.invoices[0], 'invoice');

        if (job.bills.length != 0)
            this.combineCommoditiesWithLines(job.commodities, job.bills[0], 'bill');

        Object.assign(job, stops);

        delete job.stops;

        return job;
    }

    static async createPostRecords(job, posts, currentUser)
    {
        const newPosts = [];
        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});

        for (let i = 0; i < posts.length; i++)
        {
            const post = posts[i];
            if (job.postObjects[`${post.loadboard}`]?.hasError)
            {
                job.postObjects[`${post.loadboard}`].hasError = null;
            }
            if (post.values != null)
            {
                const lbContact = await LoadboardContact.query().findById(post.values.contactId).where({ loadboard: post.loadboard });

                if (!lbContact || lbContact.loadboard != post.loadboard)
                    throw new ValidationError(`Please provide a valid contact for posting to ${post.loadboard}`);

                post.values.contact = lbContact;
            }
            if (!(post.loadboard in job.postObjects))
            {
                const objectionPost = LoadboardPost.fromJson({
                    jobGuid: job.guid,
                    loadboard: post.loadboard,
                    instructions: post.loadboardInstructions || job.loadboardInstructions?.substring(0, 59),
                    values: post.values,
                    createdByGuid: currentUser
                });
                newPosts.push(objectionPost);
            }
            else
            {
                job.postObjects[`${post.loadboard}`] = await LoadboardPost.query().patchAndFetchById(job.postObjects[`${post.loadboard}`].guid, {
                    jobGuid: job.guid,
                    loadboard: post.loadboard,
                    instructions: post.loadboardInstructions || job.postObjects[`${post.loadboard}`].loadboardInstructions || job.loadboardInstructions?.substring(0, 59),
                    isSynced: false,
                    values: post.values,
                    updatedByGuid: currentUser
                });
            }
        }
        if (newPosts.length != 0)
        {
            for (const newPost of await LoadboardPost.query().insertAndFetch(newPosts))
                job.postObjects[`${newPost.loadboard}`] = newPost;
        }

        delete job.loadboardPosts;

        return job;
    }

    static checkLoadboardsInput(posts, action)
    {
        const errorsCollection = new AppResponse();

        if (posts.length === 0)
            errorsCollection.addError(new ValidationError(`a loadboard is required, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`));

        for (const post of posts)
        {
            const lbName = post.loadboard;
            if (!(lbName in dbLoadboardNames))

                throw new ValidationError(`the loadboard: ${post.loadboard} is not supported, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`);

            if (dbLoadboardNames[lbName].requiresOptions && (action == 'post' || action == 'create'))
            {
                const requiredOptions = dbLoadboardNames[lbName].requiredFields;
                loadboardClasses[`${lbName}`].validate(requiredOptions.requiredFields, post.values);
            }
        }

        errorsCollection.throwErrorsIfExist();
    }

    // TODO: this method is on the OrderStops model, use it from there
    // recieves all the stops for a job and returns the first and last stops based on stop sequence
    static async getFirstAndLastStops(stops)
    {
        stops.sort((stop1, stop2) =>
        {
            return stop1.sequence - stop2.sequence;
        });

        return { pickup: stops[0], delivery: stops[stops.length - 1] };
    }

    /**
     *
     * @param {list<Commodity>} commodities list of job commodities
     * @param {InvoiceLine} line a single invoice/bill line
     * @param {String} lineType a string indicating if this is a bill or an invoice
     */
    static async combineCommoditiesWithLines(commodities, invoiceBill, lineType)
    {
        const map = new Map(invoiceBill.lines.filter(o =>
        {
            return o.item.name === 'transport' && o.item.type === 'revenue';
        }).map(p => [p.commodityGuid, p]));

        commodities.reduce((acc, o) =>
        {
            const match = map.get(o.guid);
            o[`${lineType}`] = match;
            return match ? acc.concat({ ...o }) : acc;
        }, []);
    }

    static getLoadboardNames(loadboardPosts)
    {
        return loadboardPosts.map(post => post?.loadboard);
    }

    /**
     * @param loadboardPosts required, json with the loadboards names sended by the client
     * @param userGuid required
     * @param orderGuid required
     * @param activityId required, 4 => Posted to a loadboard, 5 => Un-posted from loadboard
     * @param jobGuid required
    */
    static registerLoadboardStatusManager(loadboardPosts, orderGuid, userGuid, activityId, jobGuid)
    {
        const loadboardNames = LoadboardService.getLoadboardNames(loadboardPosts);
        return ActivityManagerService.createActivityLog({
            orderGuid,
            userGuid,
            activityId,
            jobGuid,
            extraAnnotations: { 'loadboards': loadboardNames }
        });
    }

    static async deletePostings(jobId, userGuid)
    {
        const job = await LoadboardService.getNotDeletedPosts(jobId);

        const payloads = [];
        let lbPayload;
        const activeExternalLBNames = [];

        // Only send for non deleted loadboards
        for (const lbName of Object.keys(job.postObjects))
        {
            lbPayload = new loadboardClasses[`${lbName}`](job);
            payloads.push(lbPayload['remove'](userGuid));
            activeExternalLBNames.push({ loadboard: lbName });
        }

        if (payloads?.length)
        {
            await sender.sendMessages({ body: payloads });
            LoadboardService.registerLoadboardStatusManager(activeExternalLBNames, job.orderGuid, userGuid, 21, jobId);
        }
    }

    static async getNotDeletedPosts(jobId)
    {
        const job = await OrderJob.query().select('orderJobs.orderGuid', 'orderJobs.guid').findById(jobId)
            .withGraphJoined('[loadboardPosts(getNotDeleted)]');

        if (!job)
        {
            throw new NotFoundError('Job not found');
        }

        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});

        delete job.loadboardPosts;

        return job;
    }

    static async postingBooked(postingGuid, carrierGuid, loadboard)
    {
        const trx = await LoadboardPost.transaction();

        try
        {
            // Get the posting and get the vendor
            const [posting, vendor] =
                await Promise.all([
                    LoadboardPost.query().where('loadboardPosts.externalPostGuid', postingGuid)
                        .withGraphJoined('job.[loadboardPosts]').first(),
                    SFAccount.query().where((builder) =>
                    {
                        if (loadboard === 'SUPERDISPATCH')
                            builder.where('sdGuid', carrierGuid);
                        else if (loadboard === 'SHIPCARS')
                            builder.where('scId', carrierGuid);
                    }).orWhere('sfId', carrierGuid).first()
                ]);

            if (!posting)
                throw new NotFoundError('Posting Not Found');
            else if (!vendor)
                throw new NotFoundError('Vendor Not Found');

            // make sure the job is still in the correct status
            if (posting.job.vendorGuid)
                throw new DataConflictError('Can not book a job that has already been booked');

            // if vendor and posting are valid
            // unpost the posting &
            // create an order job dispatch &
            // update the job with vendor
            await Promise.all([
                LoadboardRequest.query().patch({ 'isValid': false, 'isDeclined': true }).where('externalPostGuid', postingGuid),
                LoadboardService.unpostPostings(posting.job.guid, posting.job.loadboardPosts, SYSUSER),
                OrderJob.query(trx).patch({ 'vendorGuid': vendor.guid }).where('guid', posting.job.guid),
                OrderJobDispatch.query(trx).insert({
                    jobGuid: posting.job.guid,
                    loadboardPostGuid: posting.guid,
                    vendorGuid: vendor.guid,
                    isAccepted: true,
                    isPending: false,
                    createdByGuid: SYSUSER
                })
            ]);

            // fire event orderjob_booked
            emitter.emit('orderjob_booked', { jobGuid: posting.job.guid, userGuid: SYSUSER });

            await trx.commit();

            return;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    /**
     * @description This function is meant to be used after a order with jobs with a pending dispatch offer
     *  has been been updated. This function will return an array of queries that will update the
     *  current active offers price because since the price for the job has changed,
     *  this new value will be the price the dispatch offer is accepted or canceled for.
     * @param {OrderJob []} jobs An array of order jobs with a hopefully updated actualExpense field and a guid
     * @returns An array of OrderJobDispatch queries that should update only pending dispatch offers
     */
    static updateDispatchPrice(jobs)
    {
        const dispatches = [];
        for (const job of jobs)
        {
            dispatches.push(OrderJobDispatch.query().patch({
                price: job.actualExpense,
                dateUpdated: job.dateUpdated,
                updatedByGuid: job.updatedByGuid
            })
                .where({
                    jobGuid: job.guid,
                    isPending: true,
                    isValid: true,
                    isAccepted: false,
                    isDeclined: false,
                    isCanceled: false

                }));
        }
        return dispatches;
    }

    /**
     * Method queries all requests that belong to a job.
     * @param {uuid} jobGuid
     * @returns List of requests.
     */
    static async getRequestsbyJobID(jobGuid)
    {
        const requests = await LoadboardRequest.query().leftJoinRelated('posting').where('posting.jobGuid', jobGuid).orderBy('dateOfferSent', 'desc');

        return requests;
    }

    /**
     * Method is used to create request in our system from incoming webhooks.
     * @param {Model} requestModel
     * @param {Object} externalPost
     * @param {Object} carrier
     * @param {string} currentUser
     * @returns newly created request in out system.
     */
    static async createRequestfromWebhook(requestModel, externalPost, carrier, currentUser)
    {
        // query our database for requests from incoming payload
        const lbPosting = await LoadboardPost.query().withGraphJoined('[job, requests(CarrierSpecific)]')
            .modifiers({
                CarrierSpecific: (request) =>
                {
                    request.where({
                        isValid: true,
                        carrierIdentifier: carrier.usDot
                    });
                }
            })
            .findOne({
                'rcgTms.loadboardPosts.externalGuid': externalPost.guid
            });

        if (!lbPosting)
        {
            throw new NotFoundError(`The posting for ${externalPost.guid} doesn't exist for carrier ${carrier.usDot}`);
        }

        const job = lbPosting.job;

        const existingRequests = lbPosting.requests;

        // if requrest by carrier exist update it to invalid
        if (existingRequests.length > 0)
        {
            const updates = existingRequests.map(req => { req.setCanceled(); req.setUpdatedBy(currentUser); return req.$query().patch(); });
            const results = await Promise.allSettled(updates);
            const activities = [];
            for (const res of results)
            {
                if (res.status == 'rejected')
                {
                    telemetry.trackException({
                        exception: res.reason,
                        properties:
                        {
                            orderGuid: job.orderGuid,
                            jobGuid: job.guid,
                            requestExternalGuid: requestModel.externalPostGuid,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        },
                        severity: SeverityLevel.Error
                    });
                }
                else
                {
                    activities.push(
                        ActivityManagerService.createActivityLog({
                            orderGuid: job.orderGuid,
                            userGuid: currentUser,
                            jobGuid: job.guid,
                            activityId: 5,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        })
                    );
                }
            }
            await Promise.all(activities);
        }

        requestModel.posting = { '#dbRef': lbPosting.guid };
        requestModel.setNew();
        requestModel.setCreatedBy(currentUser);

        const response = await requestModel.$query().insertGraph();

        // update activities according to incoming request createBy
        await ActivityManagerService.createActivityLog({
            orderGuid: job.orderGuid,
            userGuid: currentUser,
            jobGuid: job.guid,
            activityId: 4,
            extraAnnotations: {
                loadboard: lbPosting.loadboard,
                carrier: {
                    guid: carrier.guid,
                    name: carrier.name
                }
            }
        });

        // push to pushsub
        PubSubService.publishJobRequests(job.guid, response);

        return response;
    }

    /**
     * Method is used to cancel request in our system from incoming webhooks.
     * @param {Model} requestModel
     * @param {Object} externalPost
     * @param {Object} carrier
     * @param {string} currentUser
     * @returns
     */
    static async cancelRequestfromWebhook(requestModel, externalPost, carrier, currentUser)
    {
        // query our database for requests from incoming payload
        const lbPosting = await LoadboardPost.query().withGraphJoined('[job, requests(CarrierSpecific)]')
            .modifiers({
                CarrierSpecific: (request) =>
                {
                    request.where({
                        isValid: true,
                        carrierIdentifier: carrier.usDot
                    });
                }
            })
            .findOne({
                'rcgTms.loadboardPosts.externalGuid': externalPost.guid
            });

        if (!lbPosting)
        {
            throw new NotFoundError(`The posting for ${externalPost.guid} doesn't exist for carrier ${carrier.usDot}`);
        }

        const job = lbPosting.job;

        const existingRequests = lbPosting.requests;

        if (existingRequests.length === 0)
        {
            throw new NotFoundError(`The request doesn't exist for carrier ${carrier.name}`);
        }

        const promiseArray = await existingRequests.map(request =>
        {
            request.setCanceled();
            request.setUpdatedBy(currentUser);
            return request.$query().updateAndFetch()
                .then(async result =>
                {
                    await Promise.all([
                        ActivityManagerService.createActivityLog({
                            orderGuid: job.orderGuid,
                            userGuid: currentUser,
                            jobGuid: job.guid,
                            activityId: 5,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        }),
                        PubSubService.publishJobRequests(job.guid, result)
                    ]);
                    return result;
                }).catch(error =>
                {
                    telemetry.trackException({
                        exception: error,
                        properties:
                        {
                            orderGuid: job.orderGuid,
                            jobGuid: job.guid,
                            requestExternalGuid: requestModel.externalPostGuid,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        }
                    });
                    console.log(error);
                });
        });
        const response = await Promise.all(promiseArray);
        return response;
    }

    /**
     * Method declines single request of the payload.
     * @param {uuid} requestGuid
     * @param {uuid} reason
     * @param {uuid} currentUser
     * @returns
     */
    static async declineRequestByGuid(requestGuid, reason, currentUser)
    {
        const queryRequest = await LoadboardRequest
            .query()
            .findOne({ 'rcgTms.loadboardRequests.guid': requestGuid })
            .leftJoinRelated('posting.job')
            .select('rcgTms.loadboardRequests.*', 'posting.jobGuid', 'posting:job.orderGuid');

        // to pass it on to the event
        const { jobGuid, orderGuid } = queryRequest;

        // remove fields that do not exist to update table correctly
        delete queryRequest.jobGuid;
        delete queryRequest.orderGuid;

        queryRequest.setDeclined(reason);
        queryRequest.setUpdatedBy(currentUser);

        await LoadboardsApi.sendRequest(queryRequest).catch((error) =>
        {
            error.message = `Failed to decline request. Reason: ${error}`;
            throw error;
        });

        const updatedRequest = await queryRequest.$query().patchAndFetch();

        await ActivityManagerService.createActivityLog({
            orderGuid: orderGuid,
            userGuid: currentUser,
            jobGuid: jobGuid,
            activityId: 7,
            extraAnnotations: {
                loadboard: queryRequest.loadboard,
                carrier: {
                    guid: queryRequest.extraExternalData.guid,
                    name: queryRequest.extraExternalData.name
                }
            }
        });

        PubSubService.publishJobRequests(jobGuid, updatedRequest);

        return updatedRequest;
    }

    /**
     * Methid accepts requests and creates a internal offer in our system.
     * @param {uuid} requestGuid
     * @param {uuid} currentUser
     * @returns OfferObject
     */
    static async acceptRequestbyGuid(requestGuid, currentUser)
    {
        const trx = await LoadboardRequest.startTransaction();

        // finding request to update and attach orderGUID and jobGUID
        const queryRequest = await LoadboardRequest
            .query(trx)
            .findOne({ 'loadboardRequests.guid': requestGuid })
            .leftJoinRelated('posting.job')
            .select('loadboardRequests.*', 'posting.jobGuid', 'posting:job.orderGuid');

        // check if request is found
        if (!queryRequest)
            throw new NotFoundError(`The request with guid ${requestGuid} doesn't exist`);

        const { jobGuid, orderGuid, loadboardPostGuid: internalPostGuid } = queryRequest;

        try
        {
            const promiseArray = [];
            if (queryRequest.datePickupEnd < queryRequest.dateDeliveryStart || queryRequest.dateDeliveryEnd < queryRequest.datePickupStart)
            {
                throw new DataConflictError('Pickup dates should be before delivery date');
            }

            // get Job with all data
            const [job, carrier] = await Promise.all([
                OrderJob
                    .query(trx)
                    .findById(jobGuid)
                    .withGraphFetched(`[
                stops(distinct).[primaryContact, terminal], 
                loadboardPosts(getPosted).requests(validActive),
                commodities(distinct, isNotDeleted).[vehicle, commType], 
                bills.lines(isNotDeleted, transportOnly).item,
                dispatches(activeDispatch), 
                type, 
                order.[client, clientContact, dispatcher, invoices.lines(isNotDeleted, transportOnly).item]
            ]`),
                SFAccount.query(trx)
                    .modify('externalIdandDot', queryRequest.extraExternalData.carrierInfo.guid, queryRequest.carrierIdentifier)
            ]);

            if (!job)
            {
                throw new NotFoundError('Job Not Found');
            }

            // validate job not be be in
            job.validateJobForDispatch();

            // validate carriers
            if (!carrier)
            {
                throw new NotFoundError(`Carrier does not exist in our system. USDOT:${queryRequest.carrierIdentifier}; Name:${queryRequest.extraExternalData.carrierInfo.guid}`);
            }
            else if (carrier.blacklist == true || carrier.active == false)
            {
                throw new NotAllowedError('Carrier is inactive or blacklisted.');
            }

            // remove fields that do not exist to update table correctly
            delete queryRequest.jobGuid;
            delete queryRequest.orderGuid;

            // updating object for loadboard logic
            queryRequest.setAccepted();
            queryRequest.setUpdatedBy(currentUser);

            let offerPayload;
            try
            {
                offerPayload = await LoadboardsApi.sendRequest(queryRequest);
            }
            catch (error)
            {
                await trx.rollback();
                telemetry.trackException({
                    exception: error,
                    properties:
                    {
                        jobGuid: jobGuid,
                        postGuid: internalPostGuid,
                        extraAnnotations: {
                            loadboard: offerPayload.loadboard,
                            carrier: {
                                guid: offerPayload.carrier.guid,
                                name: offerPayload.carrier.name
                            }
                        }
                    }
                });
                error.message = 'Failed to accept request';
                throw error;
            }

            // attaching carrier to returned payload
            Object.assign(offerPayload.data.carrier, carrier);

            // create offer in our sysytem
            const createdOffer = await LoadboardService.createInternalOffer(trx, job, internalPostGuid, offerPayload.data, currentUser);

            // get all active requests for the current job
            const activeRequests = await LoadboardRequest.query(trx).leftJoinRelated('posting').where('posting.guid', internalPostGuid).andWhereNot('loadboardRequests.guid', queryRequest.guid).modify('validActive');

            // 'Load is no longer available.'
            for (const request of activeRequests)
            {
                request.setDeclined('Load is no longer available.');
                request.setUpdatedBy(currentUser);
                promiseArray.push(request.$query(trx).patchAndFetch());
            }

            promiseArray.push(queryRequest.$query(trx).update());

            await Promise.all(promiseArray);

            await ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                userGuid: currentUser,
                jobGuid: jobGuid,
                activityId: 6,
                extraAnnotations: {
                    loadboard: queryRequest.loadboard,
                    vendorGuid: createdOffer.vendor.guid,
                    vendorName: createdOffer.vendor.name,
                    dotNumber: createdOffer.vendor.dotNumber
                }
            });

            await trx.commit();

            emitter.emit('load_request_accepted', { jobGuid });

            return createdOffer;
        }
        catch (error)
        {
            telemetry.trackException({
                exception: error,
                properties:
                {
                    jobGuid: jobGuid,
                    postGuid: queryRequest.loadboardPostGuid,
                    requestGuid: requestGuid,
                    extraAnnotations: {
                        loadboard: queryRequest.loadboard,
                        carrier: {
                            guid: queryRequest.extraExternalData.carrierInfo.guid,
                            name: queryRequest.extraExternalData.carrierInfo.name
                        }
                    }
                }
            });
            await trx.rollback();
            throw error;
        }
    }

    /**
     * Method creates a offer internally and handles all un posting of loadboards.
     * @param {Object} trx
     * @param {Object} job
     * @param {uuid} internalPostGuid
     * @param {Obejct} offerPayload
     * @param {uuid} currentUser
     * @returns Created offer
     */
    static async createInternalOffer(trx, job, internalPostGuid, offerPayload, currentUser)
    {
        const promiseArray = [];

        // get only first and last stop only
        job.stops = OrderStop.firstAndLast(job.stops);
        const bill = job?.bills[0];
        const firstStop = job.stops[0];
        const lastStop = job.stops[1];
        const removePosts = job.loadboardPosts.filter(item => item?.guid !== internalPostGuid);
        const unPosts = job.loadboardPosts.filter(item => item?.guid === internalPostGuid);
        const upPostInternalPosting = unPosts[0];

        upPostInternalPosting.setToUnposted();
        upPostInternalPosting.setUpdatedBy(currentUser);
        promiseArray.push(upPostInternalPosting.$query(trx).patch());

        let carrierContact;

        // if driver being assigned through internal
        if (offerPayload.driver.guid)
        {
            carrierContact = await SFContact.query(trx).modify('byId', offerPayload.driver.guid).first();
        }
        else
        {
            // creating carrier driver
            carrierContact = SFContact.fromJson({
                name: offerPayload.driver.name,
                email: offerPayload.driver.email,
                phoneNumber: offerPayload.driver.phoneNumber,
                accountId: offerPayload.carrier.sfId
            });
            carrierContact = await carrierContact.$query(trx).insertAndFetch();
        }

        // split cost amongst commoditites
        const lines = BillService.splitCarrierPay(bill, job.commodities, offerPayload.price, currentUser);
        for (const line of lines)
            line.transacting(trx);

        promiseArray.push(...lines);

        bill.paymentTermId = offerPayload.paymentTerm;
        bill.setUpdatedBy(currentUser);
        promiseArray.push(bill.$query(trx).patch());

        firstStop.setScheduledDates(offerPayload.pickup.type, offerPayload.pickup.pickUpStart, offerPayload.pickup.pickUpEnd);
        firstStop.setUpdatedBy(currentUser);
        promiseArray.push(firstStop.$query(trx).patch());

        lastStop.setScheduledDates(offerPayload.delivery.type, offerPayload.delivery.deliveryStart, offerPayload.delivery.deliveryEnd);
        lastStop.setUpdatedBy(currentUser);
        promiseArray.push(lastStop.$query(trx).patch());

        // update job status
        job.setUpdatedBy(currentUser);
        promiseArray.push(job.$query(trx).patch({
            status: OrderJob.STATUS.PENDING
        }));

        // create Offer in our system
        const dispatch = OrderJobDispatch.fromJson({
            job: { '#dbRef': job.guid },
            loadboardPost: { '#dbRef': internalPostGuid },
            vendor: { '#dbRef': offerPayload.carrier.guid },
            vendorAgent: { '#dbRef': carrierContact.guid },
            externalGuid: offerPayload.externalOfferGuid || offerPayload.externalPostGuid,
            paymentTermId: offerPayload.paymentTerm,
            price: offerPayload.price
        });
        dispatch.setCreatedBy(currentUser);
        const myDispatch = await OrderJobDispatch.query(trx).insertGraphAndFetch(dispatch, { relate: true });

        const postArray = [];

        // unpost all active posts in and update related request
        for (const post of removePosts)
        {
            postArray.push(LoadboardsApi.sendUnPost(post));
            post.setToUnposted();
            post.setUpdatedBy(currentUser);
            promiseArray.push(post.$query(trx).patch());
            const lbRequest = new LoadboardRequest();
            lbRequest.setDeclined(LoadboardRequest.DECLINE_REASON.UNPOSTED);
            promiseArray.push(post.$relatedQuery('requests', trx).for(post).patch(lbRequest));
        }

        const res = await Promise.allSettled(postArray);
        for (const r of res)
        {
            if (r.status == 'rejected')
            {
                telemetry.trackException({
                    exception: r.reason,
                    properties:
                    {
                        jobGuid: job.guid,
                        postGuid: internalPostGuid,
                        extraAnnotations: {
                            loadboard: offerPayload.loadboard,
                            carrier: {
                                guid: offerPayload.carrier.guid,
                                name: offerPayload.carrier.name
                            }
                        }
                    }
                });
            }
            else if (r.value)
            {
                const post = r.value.data.data;
                await ActivityManagerService.createActivityLog({
                    orderGuid: job.orderGuid,
                    userGuid: currentUser,
                    activityId: 3,
                    jobGuid: job.guid,
                    extraAnnotations: {
                        loadboard: post.loadboard
                    }
                });
            }
        }

        // add for every success to say unposted push notification
        await Promise.all(promiseArray);

        return myDispatch;
    }
}

module.exports = LoadboardService;
