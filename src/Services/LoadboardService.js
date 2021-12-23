const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const loadboardClasses = require('../Loadboards/LoadboardsList');
const LoadboardContact = require('../Models/LoadboardContact');
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const { ServiceBusClient } = require('@azure/service-bus');
const LoadboardPost = require('../Models/LoadboardPost');
const OrderStopLink = require('../Models/OrderStopLink');
const InvoiceBill = require('../Models/InvoiceBill');
const Loadboard = require('../Models/Loadboard');
const SFAccount = require('../Models/SFAccount');
const SFContact = require('../Models/SFContact');
const OrderStop = require('../Models/OrderStop');
const BillService = require('./BIllService');
const Job = require('../Models/OrderJob');
const EventEmitter = require('events');
const { DateTime } = require('luxon');
const HttpError = require('../ErrorHandling/Exceptions/HttpError');
const { raw } = require('objection');
const InvoiceLine = require('../Models/InvoiceLine');
const currency = require('currency.js');

const connectionString = process.env['azure.servicebus.loadboards.connectionString'];
const queueName = 'loadboard_posts_outgoing';
const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(queueName);
const emitter = new EventEmitter();

const dispatchableLoadboards = ['SUPERDISPATCH', 'SHIPCARS'];
let dbLoadboardNames;

(async function ()
{
    dbLoadboardNames = (await Loadboard.query()).reduce((acc, curr) => (acc[curr.name] = curr, acc), {});
})();

class LoadboardService
{
    static async getAllLoadboardPosts(jobId)
    {
        const posts = (await LoadboardPost.query().where({ jobGuid: jobId })).reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});

        if (!posts)
            throw new Error('Job not found');

        return posts;
    }

    static async createPostings(jobId, posts, currentUser)
    {
        const job = await LoadboardService.getAllPostingData(jobId, posts, currentUser);
        const payloads = [];
        let lbPayload;

        try
        {
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
        }
        catch (e)
        {
            throw new Error(e.toString());
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
            throw new Error('Cannot post load with active dispatch offers');

        const job = await LoadboardService.getAllPostingData(jobId, posts, currentUser);
        const payloads = [];
        let lbPayload;

        try
        {
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
        catch (e)
        {
            throw new Error(e.toString());
        }

    }

    static async unpostPostings(jobId, posts, currentUser)
    {
        const job = await LoadboardService.getPostRecords(jobId, posts);
        const payloads = [];
        let lbPayload;

        try
        {
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
        catch (e)
        {
            throw new Error(e.toString());
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
                throw new Error(`${body.loadboard} cannot be dispatched to, you can only dispatch to ${dispatchableLoadboards}`);

            let job = {};

            // if dispatching internally, no need to worry about making sure the load is in
            // another loadboard, otherwise first create a posting record and dispatch
            if (!body.loadboard)
            {
                job = await Job.query(trx).findById(jobId).withGraphFetched('[stops(distinct), commodities(distinct, isNotDeleted), bills, dispatches(activeDispatch), type, order]');

                if(!job)
                {
                    throw new HttpError(404, 'Job not found');
                }

                const stops = await this.getFirstAndLastStops(job.stops);

                Object.assign(job, stops);
            }
            else
            {
                job = await this.getAllPostingData(jobId, [{ loadboard: body.loadboard }], currentUser);

                job.dispatches = await OrderJobDispatch.query(trx).where({ jobGuid: jobId }).where({ isPending: true, isCanceled: false }).orWhere({ isAccepted: true, isCanceled: false }).limit(1);
            }

            job.validateJobForDispatch();

            const carrier = await SFAccount.query(trx).modify('byId', body.carrier.guid).modify('carrier').first();
            const driver = body.driver;

            if (!carrier)
                throw new Error('carrier not found, please pass in a valid guid, salesforce id, or dot number');
            else if (carrier.status == 'Inactive' || carrier.status == 'Blacklist' || carrier.blaclist == true)
                throw new Error(`Carrier has a status of ${carrier.status} and cannot be dispatched to without manager approval`);

            let carrierContact = driver.guid == null ? driver : await SFContact.query().modify('byId', driver.guid).first();

            // first check if the contact exists based off guid that was passed in
            if (!carrierContact?.guid)
            {
                if (driver.name == null || driver.email == null || driver.phoneNumber == null)
                    throw new Error('Please pass in valid driver object that includes a proper name, email, and phone');

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
                    throw new Error('Please pass in valid driver for carrier');
            }

            await InvoiceBill.query(trx).patch({ paymentTermId: body.paymentTerm, updatedByGuid: currentUser }).findById(job?.bills[0]?.guid);
            const lines = BillService.splitCarrierPay(job.bills[0], job.commodities, body.price, currentUser);
            for (const line of lines)
                line.transacting(trx);

            allPromises.push(...lines);

            job.pickup.setScheduledDates(body.pickup.dateType, body.pickup.startDate, body.pickup.endDate);
            job.pickup.setUpdatedBy(currentUser);
            allPromises.push(OrderStop.query(trx).patch(job.pickup).findById(job.pickup.guid));

            job.delivery.setScheduledDates(body.delivery.dateType, body.delivery.startDate, body.delivery.endDate);
            job.delivery.setUpdatedBy(currentUser);
            allPromises.push(OrderStop.query(trx).patch(job.delivery).findById(job.delivery.guid));

            if (job.delivery.dateScheduledStart < job.pickup.dateScheduledStart ||
                job.delivery.dateScheduledEnd < job.pickup.dateScheduledEnd)
            {
                throw new Error('Pickup dates should be before delivery date');
            }

            const jobForUpdate = Job.fromJson({
                dateStarted: DateTime.utc(),
                status: Job.STATUS.PENDING
            });

            jobForUpdate.setUpdatedBy(currentUser);

            allPromises.push(Job.query(trx).patch(jobForUpdate).findById(job.guid));

            let lbPost;
            try
            {
                lbPost = body.loadboard == null ? null : job.postObjects[`${body.loadboard}`].guid;
            }
            catch (e)
            {
                throw `Loadboard Post for ${body.loadboard} is out of sync. Please fix the job and the resync the loadboard post before dispatching`;
            }

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
                const lbPayload = new loadboardClasses[`${body.loadboard}`](job);
                message = [lbPayload['dispatch']()];

                await sender.sendMessages({ body: message });
            }

            // this grabs all the loadboard posts that are posted excluding the loadboard
            // that is being to dispatched to now because that loadboard post is now out of sync
            // until the job is completely dispatched and a successful response is returned
            const posts = await LoadboardPost.query(trx).select('loadboard').where({ status: 'posted', isPosted: true, isSynced: true, jobGuid: jobId });

            this.unpostPostings(jobId, posts, currentUser);

            // compose response that can be useful for client
            dispatch.vendor = carrier;
            dispatch.vendorAgent = carrierContact;

            // since there is no loadboard to dispatch to, we can write the status log right away
            if (!lbPost)
            {
                StatusManagerHandler.registerStatus({
                    orderGuid: job.orderGuid,
                    userGuid: currentUser,
                    statusId: 10,
                    jobGuid: jobId,
                    extraAnnotations: {
                        dispatchedTo: 'internal',
                        code: 'pending',
                        vendorGuid: dispatch.vendor.guid,
                        vendorAgentGuid: dispatch.vendorAgentGuid,
                        vendorName: dispatch.vendor.name,
                        vendorAgentName: dispatch.vendorAgent.name
                    }
                });
            }

            await Promise.all(allPromises);
            await trx.commit();

            emitter.emit('orderjob_dispatch_offer_sent', {
                jobGuid: job.guid,
                dispatchGuid: job.dispatch.guid
            });
            dispatch.jobStatus = Job.STATUS.PENDING;
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
            const dispatch = await OrderJobDispatch.query()
                .select('rcgTms.orderJobDispatches.guid',
                    'rcgTms.orderJobDispatches.jobGuid',
                    'isAccepted',
                    'isPending',
                    'isCanceled',
                    'isDeclined')
                .withGraphJoined('[loadboardPost, job, vendor, vendorAgent]')
                .findOne({ 'rcgTms.orderJobDispatches.jobGuid': jobGuid })
                .andWhere(builder =>
                {
                    builder.where({ isAccepted: true }).orWhere({ isPending: true });
                })
                .modifyGraph('job', builder => builder.select('rcgTms.orderJobs.guid', 'orderGuid'))
                .modifyGraph('vendor', builder => builder.select('name', 'salesforce.accounts.guid'))
                .modifyGraph('vendorAgent', builder => builder.select('name', 'salesforce.contacts.guid'));
                
            if (!dispatch)
                throw new HttpError(404, 'No active offers to undispatch');
            
            dispatch.setUpdatedBy(currentUser);
            if (dispatch.loadboardPostGuid != null)
            {
                const job = await this.getAllPostingData(jobGuid, [{ loadboard: dispatch.loadboardPost.loadboard }], currentUser);
                job.dispatch = dispatch;
                const lbPayload = new loadboardClasses[`${dispatch.loadboardPost.loadboard}`](job);
                const message = [lbPayload['undispatch']()];

                await sender.sendMessages({ body: message });
            }
            else
            {
                dispatch.isPending = false;
                dispatch.isAccepted = false;
                dispatch.isCanceled = true;

                await OrderJobDispatch.query(trx).patch(dispatch).findById(dispatch.guid);
                await OrderStop.query(trx)
                    .patch({ dateScheduledStart: null, dateScheduledEnd: null, dateScheduledType: null, updatedByGuid: currentUser })
                    .whereIn('guid',
                        OrderStopLink.query().select('stopGuid')
                            .where({ 'jobGuid': jobGuid })
                            .distinctOn('stopGuid')
                    );

                const job = Job.fromJson({
                    vendorGuid: null,
                    vendorAgentGuid: null,
                    vendorContact: null,
                    dateStarted: null,
                    status: 'ready'
                });

                job.setUpdatedBy(currentUser);

                await Job.query(trx).patch(job).findById(dispatch.jobGuid);
                dispatch.jobStatus = 'ready';
            }

            await trx.commit();

            if (!dispatch.loadboardPostGuid)
            {
                StatusManagerHandler.registerStatus({
                    orderGuid: dispatch.job.orderGuid,
                    userGuid: currentUser,
                    statusId: 12,
                    jobGuid,
                    extraAnnotations: {
                        undispatchedFrom: 'internal',
                        code: 'ready',
                        vendorGuid: dispatch.vendor.guid,
                        vendorAgentGuid: dispatch.vendorAgentGuid,
                        vendorName: dispatch.vendor.name,
                        vendorAgentName: dispatch.vendorAgent.name
                    }
                });
            }

            return dispatch;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    static async acceptDispatch(jobGuid, dispatchGuid, currentUser)
    {
        const trx = await OrderJobDispatch.startTransaction();
        const allPromises = [];

        try
        {
            const job = await Job.query(trx).findById(jobGuid)
                .select([
                    Job.ref('*'),
                    Job.relatedQuery('dispatches').where({
                        isValid: true,
                        isPending: true
                    }).count().as('validDispatchesCount')
                ]);

            if (!job)
                throw new Error('Job not found');

            job.validateJobForAccepting();

            const dispatch = await job.$relatedQuery('dispatches', trx).findById(dispatchGuid);

            if (!dispatch)
                throw new Error('Dispatch not found');

            allPromises.push(job.$relatedQuery('dispatches', trx).patch({
                isValid: false,
                isPending: false,
                dateAccepted: null,
                dateDeclined: null,
                isAccepted: false,
                isDeclined: false,
                isCanceled: raw('(CASE WHEN "is_pending" THEN true ELSE false END)'),
                dateCanceled: raw('(CASE WHEN "is_pending" = true THEN NOW() ELSE null END)')
            }).whereNot({ guid: dispatch.guid }));

            allPromises.push(dispatch.$relatedQuery('loadboardPost', trx).patch({ isPosted: false }));
            
            allPromises.push(dispatch.$query(trx).patch({
                isAccepted: true,
                isPending: false,
                dateAccepted: new Date(),
                isDeclined: false,
                dateCanceled: null,
                dateDeclined: null,
                updatedByGuid: currentUser
            }));

            allPromises.push(job.$query(trx).patch({
                vendorGuid: dispatch.vendorGuid,
                vendorContactGuid: dispatch.vendorContactGuid,
                vendorAgentGuid: dispatch.vendorAgentGuid,
                updatedByGuid: currentUser
            }));

            let jobBillLinesCount = await dispatch.$query(trx).joinRelated('job.bills.lines').count('job:bills:lines.*');
            jobBillLinesCount = jobBillLinesCount.count;
            const dispatchPrice = dispatch.price;
            const priceToSave = currency(dispatchPrice).divide(jobBillLinesCount);
            
            const jobBillLines = await dispatch.$query(trx)
                .joinRelated('job.bills.lines')
                .select('job:bills:lines.*', 'job.isTransport')
                .where({ 'job.isTransport': true });

            if (Array.isArray(jobBillLines) && jobBillLines.length > 0)
                for (const line of jobBillLines)
                    if (currency(line.amount).value !== priceToSave.value)
                        allPromises.push(
                            InvoiceLine.query(trx)
                                .patch({ amount: priceToSave.value })
                                .where({ guid: line.guid })
                        );
            else if (
                !Array.isArray(jobBillLines) &&
                currency(jobBillLines.amount).value !== priceToSave.value
            )
                allPromises.push(
                    InvoiceLine.query(trx)
                        .patch({ amount: priceToSave.value })
                        .where({ guid: jobBillLines.guid })
                );

            const jobBill = await dispatch.$query(trx)
                .joinRelated('job.bills')
                .select('job:bills.*', 'job.isTransport')
                .where({ 'job.isTransport': true })
                .debug();
            
            allPromises.push(
                InvoiceBill.query(trx).patch({
                    paymentTermId: dispatch.paymentTermId,
                    paymentMethodId: dispatch.paymentMethodId,
                    consigneeGuid: dispatch.vendorGuid
                }).findById(jobBill.guid)
            );

            await Promise.all(allPromises);
            await trx.commit();

            StatusManagerHandler.registerStatus({
                orderGuid: job.orderGuid,
                userGuid: currentUser,
                statusId: 13,
                jobGuid: job.guid
            });

            return;
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
        const job = await Job.query().findById(jobId).withGraphFetched(`[
            commodities(distinct, isNotDeleted).[vehicle, commType],
            order.[client, clientContact, dispatcher, invoices.lines.item],
            stops(distinct).[primaryContact, terminal], 
            loadboardPosts(getExistingFromList),
            equipmentType, 
            bills.lines(isNotDeleted, transportOnly).item,
            dispatcher, type
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        if (!job)
            throw new Error('Job not found');

        if(job.isOnHold)
        {
            throw new Error('Cannot get posting data for job that is on hold');
        }

        await this.createPostRecords(job, posts, currentUser);

        if (job.order.invoices.length != 0)
            this.combineCommoditiesWithLines(job.commodities, job.order.invoices[0], 'invoice');

        // delete job.order.invoices;
        if (job.bills.length != 0)
            this.combineCommoditiesWithLines(job.commodities, job.bills[0], 'bill');

        // delete job.bills;
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

        const job = await Job.query().findById(jobId).withGraphFetched(`[
            loadboardPosts(getExistingFromList, getPosted)
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        if (!job)
            throw new Error('Job not found');

        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});

        delete job.loadboardPosts;

        return job;
    }

    // This method is for getting all existing data for the job
    static async getjobDataForUpdate(jobId)
    {
        const job = await Job.query().findById(jobId).withGraphFetched(`[
            commodities(distinct).[vehicle, commType], 
            order.[client, clientContact, invoices.lines(transportOnly).item],
            stops(distinct).[primaryContact, terminal], 
            loadboardPosts(getExistingFromList),
            equipmentType, 
            bills.lines(isNotDeleted, transportOnly).item,
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
                delete job.postObjects[`${post.loadboard}`];
                posts.splice(i, 1);
            }
            else
            {
                if (post.values != null)
                {
                    const lbContact = await LoadboardContact.query().findById(post.values.contactId).where({ loadboard: post.loadboard });

                    if (!lbContact || lbContact.loadboard != post.loadboard)
                        throw 'please provide a valid loadboard contact id';

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
        const errors = [];

        if (posts.length === 0)
            errors.push(new Error(`a loadboard is required, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`));

        for (const post of posts)
        {
            const lbName = post.loadboard;
            if (!(lbName in dbLoadboardNames))

                throw new Error(`the loadboard: ${post.loadboard} is not supported, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`);

            if (dbLoadboardNames[lbName].requiresOptions && (action == 'post' || action == 'create'))
            {
                const requiredOptions = dbLoadboardNames[lbName].requiredFields;
                loadboardClasses[`${lbName}`].validate(requiredOptions.requiredFields, post.values);
            }
        }

        if (errors.length !== 0)
            throw errors;
    }

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
     * @param statusId required, 4 => Posted to a loadboard, 5 => Un-posted from loadboard
     * @param jobGuid required
    */
    static registerLoadboardStatusManager(loadboardPosts, orderGuid, userGuid, statusId, jobGuid)
    {
        const loadboardNames = LoadboardService.getLoadboardNames(loadboardPosts);
        return StatusManagerHandler.registerStatus({
            orderGuid,
            userGuid,
            statusId,
            jobGuid,
            extraAnnotations: { 'loadboards': loadboardNames }
        });
    }

    static async deletePostings(jobId, posts, userGuid)
    {
        const job = await LoadboardService.getNotDeletedPosts(jobId, posts);
        const payloads = [];
        let lbPayload;

        try
        {
            // Only send for non deleted loadboards
            for (const lbName of Object.keys(job.postObjects))
            {
                lbPayload = new loadboardClasses[`${lbName}`](job);
                payloads.push(lbPayload['remove'](userGuid));
            }

            if (payloads?.length)
            {
                await sender.sendMessages({ body: payloads });
                LoadboardService.registerLoadboardStatusManager(posts, job.orderGuid, userGuid, 21, jobId);
            }
        }
        catch (e)
        {
            throw new Error(e.toString());
        }
    }

    static async getNotDeletedPosts(jobId, posts)
    {
        const loadboardNames = posts.map((post) => { return post.loadboard; });
        const job = await Job.query().findById(jobId).withGraphFetched(`[
            loadboardPosts(getExistingFromList, getNotDeleted)
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        if (!job)
            throw new Error('Job not found');

        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});
        delete job.loadboardPosts;

        return job;
    }
}

module.exports = LoadboardService;
