const Loadboard = require('../Models/Loadboard');
const LoadboardPost = require('../Models/LoadboardPost');
const LoadboardContact = require('../Models/LoadboardContact');
const Job = require('../Models/OrderJob');
const SFAccount = require('../Models/SFAccount');
const InvoiceLine = require('../Models/InvoiceLine');
const currency = require('currency.js');

const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const loadboardClasses = require('../Loadboards/LoadboardsList');

const { ServiceBusClient } = require('@azure/service-bus');
const SFContact = require('../Models/SFContact');
const InvoiceBill = require('../Models/InvoiceBill');
const OrderStop = require('../Models/OrderStop');
const OrderJobDispatch = require('../Models/OrderJobDispatch');

const connectionString = process.env['azure.servicebus.loadboards.connectionString'];
const queueName = 'test_queue';
const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(queueName);

let currentUserGuid = '00000000-0000-0000-0000-000000000000';
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
        return (await LoadboardPost.query().where({ jobGuid: jobId })).reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});
    }

    static async createPostings(jobId, posts, currentUser)
    {
        currentUserGuid = currentUser;
        const job = await LoadboardService.getAllPostingData(jobId, posts);
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
        currentUserGuid = currentUser;
        const job = await LoadboardService.getAllPostingData(jobId, posts);
        const payloads = [];
        let lbPayload;

        try
        {
            for (const post of posts)
            {
                lbPayload = new loadboardClasses[`${post.loadboard}`](job);
                payloads.push(lbPayload['post']());
            }
            console.log(payloads);

            // sending all payloads as one big object so one big response can be returned
            // and handler can then use one big transaction to update all records rather
            // than have a single new transaction for each posting
            if (payloads.length != 0)
            {
                await sender.sendMessages({ body: payloads });
            }
        }
        catch (e)
        {
            throw new Error(e.toString());
        }

        LoadboardService.registerLoadboardStatusManager(posts, job.orderGuid, currentUser, 2);
    }

    static async unpostPostings(jobId, posts, currentUser)
    {
        const job = await LoadboardService.getPostRecords(jobId, posts);
        currentUserGuid = currentUser;
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
            }
        }
        catch (e)
        {
            throw new Error(e.toString());
        }

        LoadboardService.registerLoadboardStatusManager(posts, job.orderGuid, currentUser, 3);
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

    static async dispatchToLoadboard(jobId, body)
    {

    }

    static async dispatchInternally(jobId, body)
    {
        const carrier = (await SFAccount.query().modify('byId', body.carrier.guid).modify('carrier'))[0];
        const driver = body.driver;

        if (!carrier)
        {
            throw new Error('carrier not found, please pass in a valid guid, salesforce id, or dot number');
        }
        else if (carrier.status == 'Inactive' || carrier.status == 'Blacklist')
        {
            throw new Error(`Carrier has a status of ${carrier.status} and cannot be dispatched to without manager approval`);
        }

        let carrierContact = driver.guid == null ? driver : (await SFContact.query().modify('byId', driver.guid))[0];

        // first check if the contact exists based off guid that was passed in
        if (carrierContact.guid == null)
        {
            if (driver.name == null || driver.email == null || driver.phoneNumber == null)
            {
                throw new Error('Please pass in valid driver object that includes a proper name, email, and phone');
            }
            carrierContact = SFContact.fromJson(carrierContact);
            carrierContact.accountId = carrier.sfId;
            carrierContact = await SFContact.query().insertAndFetch(carrierContact);
        }
        else
        {
            console.log('not creating new contact');
            if (carrierContact.accountId != carrier.sfId)
            {
                throw new Error('Please pass in valid driver for carrier');
            }
        }

        if (body.loadboard != null && !dispatchableLoadboards.includes(body.loadboard))
        {
            throw new Error(`${body.loadboard} cannot be dispatched to, you can only dispatch to ${dispatchableLoadboards}`);
        }
        let job = {};

        // if dispatching internally, no need to worry about making sure the load is in
        // another loadboard, otherwise first create a posting record and dispatch
        if (!body.loadboard)
        {
            job = await Job.query().findById(jobId).withGraphFetched('[stops(distinct), commodities(distinct, isNotDeleted), bills.lines(isNotDeleted, transportOnly).item, dispatches(activeDispatch)]');
            const stops = await this.getFirstAndLastStops(job.stops);
            Object.assign(job, stops);

            // this.combineCommoditiesWithLines(job.commodities, job.bills[0], 'bill');
        }
        else
        {
            job = await this.getAllPostingData(jobId, [{ loadboard: body.loadboard }]);
        }

        if (job.isDummy)
        {
            throw new Error('Cannot dispatch dummy job');
        }

        if (job.dispatches.length != 0)
        {
            throw new Error('Cannot dispatch with already active load offer');
        }

        job.vendorGuid = carrier.guid;
        job.vendorAgentGuid = carrierContact.guid;

        const jobTotalPrice = job.bills[0].lines.reduce((a, expenseLine) =>
        {
            return a.add(currency(expenseLine.amount));
        }, currency(0));

        const bill = job.bills[0];
        await InvoiceBill.query().patch({ paymentMethodId: body.paymentMethod, paymentTermId: body.paymentTerm, updatedByGuid: currentUserGuid }).findById(bill.guid);
        if (body.price !== jobTotalPrice.value)
        {
            const lines = bill.lines;
            const distribution = currency(body.price).distribute(job.bills[0].lines.length);
            for (let i = 0; i < lines.length; i++)
            {
                const billLine = lines[i];
                const amount = distribution[i].value;
                await InvoiceLine.query().patch({ amount: amount, updatedByGuid: currentUserGuid }).findById(billLine.guid);
            }
        }

        job.pickup.dateScheduledType = body.pickup.dateType;
        job.pickup.dateScheduledStart = body.pickup.startDate;
        job.pickup.dateScheduledEnd = body.pickup.dateType == 'estimated' ? body.pickup.endDate : null;
        job.pickup.updatedByGuid = currentUserGuid;
        await OrderStop.query().patch(job.pickup).findById(job.pickup.guid);

        job.delivery.dateScheduledType = body.delivery.dateType;
        job.delivery.dateScheduledStart = body.delivery.startDate;
        job.delivery.dateScheduledEnd = body.delivery.dateType == 'estimated' ? body.delivery.endDate : null;
        job.delivery.updatedByGuid = currentUserGuid;
        await OrderStop.query().patch(job.delivery).findById(job.delivery.guid);

        await Job.query().patch({ vendorGuid: carrier.guid, vendorAgentGuid: carrierContact.guid, updatedByGuid: currentUserGuid }).findById(job.guid);
        job.vendor = carrier;
        job.vendorAgent = driver;

        // const lbPost = body.loadboard == null ? null : job.postObjects[`${body.loadboard}`].guid;
        const lbPost = body.loadboard == null ? null : job.postObjects[`${body.loadboard}`].guid;
        const dispatch = OrderJobDispatch.fromJson({
            jobGuid: job.guid,
            loadboardPostGuid: lbPost,
            vendorGuid: carrier.guid,
            vendorAgentGuid: driver.guid,
            externalGuid: null,
            isActive: true,
            isCanceled: false,
            paymentTerm: body.paymentTerm,
            paymentMethod: body.paymentMethod,
            price: body.price,
            createdByGuid: currentUserGuid
        });

        job.dispatch = await OrderJobDispatch.query().insertAndFetch(dispatch);

        let message = {};
        if (lbPost)
        {
            const lbPayload = new loadboardClasses[`${body.loadboard}`](job);
            message = [lbPayload['dispatch']()];

            // await sender.sendMessages({ body: message });
        }

        return dispatch;
    }

    static async cancelDispatch(jobGuid)
    {
        const dispatch = (await OrderJobDispatch.query().withGraphJoined('loadboardPost').where({ 'rcgTms.orderJobDispatches.jobGuid': jobGuid, isActive: true, isCanceled: false }))[0];

        await OrderJobDispatch.query().patch({ isActive: false, isCanceled: true, updatedByGuid: currentUserGuid }).findById(dispatch.guid);

        // const fakeJob = { postObjects: {} };

        // fakeJob.postObjects[`${dispatch.loadboardPost.loadboard}`] = dispatch.loadboardPost;
        // fakeJob.dispatch = dispatch;

        // const lbPayload = new loadboardClasses[`${dispatch.loadboardPost.loadboard}`](fakeJob);
        // const message = [lbPayload['undispatch']()];
        // console.log(message);
        // await sender.sendMessages({ body: message });

        return dispatch;
    }

    // This method gets all the job information and creates new post records based on the posts
    // list that is sent in if needed
    static async getAllPostingData(jobId, posts)
    {
        const loadboardNames = posts.map((post) => { return post.loadboard; });
        const job = await Job.query().findById(jobId).withGraphFetched(`[
            commodities(distinct, isNotDeleted).[vehicle, commType],
            order.[client, clientContact, dispatcher, invoices.lines.item],
            stops(distinct).[primaryContact, terminal], 
            loadboardPosts(getExistingFromList),
            equipmentType, 
            bills.lines(isNotDeleted, transportOnly).item,
            dispatcher
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        await this.createPostRecords(job, posts);
        this.combineCommoditiesWithLines(job.commodities, job.order.invoices[0], 'invoice');

        // delete job.order.invoices;
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

        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});

        delete job.loadboardPosts;
        return job;
    }

    // This method is for getting all existing data for the job
    static async getjobDataForUpdate(jobId)
    {
        const job = await Job.query().findById(jobId).withGraphFetched(`[
            commodities(distinct).[vehicle, commType], order.[client, clientContact, owner],
            stops(filterDistinct).[primaryContact, terminal], loadboardPosts(getExistingFromList),
            equipmentType
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getValid')
        });

        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});
        const stops = await this.getFirstAndLastStops(job.stops);
        Object.assign(job, stops);
        delete job.stops;
        return job;
    }

    static async createPostRecords(job, posts)
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
                    post.values.contact = lbContact;
                }
                if (!(post.loadboard in job.postObjects))
                {
                    const objectionPost = LoadboardPost.fromJson({
                        jobGuid: job.guid,
                        loadboard: post.loadboard,
                        instructions: post.loadboardInstructions || job.loadboardInstructions?.substring(0, 59),
                        values: post.values,
                        createdByGuid: currentUserGuid
                    });
                    newPosts.push(objectionPost);
                }
                else
                {
                    job.postObjects[`${post.loadboard}`] = await LoadboardPost.query().patchAndFetchById(job.postObjects[`${post.loadboard}`].guid, {
                        jobGuid: job.guid,
                        loadboard: post.loadboard,
                        instructions: post.loadboardInstructions || job.loadboardInstructions?.substring(0, 59),
                        isSynced: false,
                        values: post.values,
                        updatedByGuid: currentUserGuid
                    });
                }
            }
        }
        if (newPosts.length != 0)
        {
            for (const newPost of await LoadboardPost.query().insertAndFetch(newPosts))
            {
                job.postObjects[`${newPost.loadboard}`] = newPost;
            }
        }
        delete job.loadboardPosts;
        return job;
    }

    static checkLoadboardsInput(posts)
    {
        const errors = [];
        if (posts.length === 0)
        {
            errors.push(new Error(`a loadboard is required in order to post, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`));
        }
        for (const post of posts)
        {
            const lbName = post.loadboard;
            if (!(lbName in dbLoadboardNames))
            {
                throw new Error(`the loadboard: ${post.loadboard} is not supported, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`);
            }
            if (dbLoadboardNames[lbName].requiresOptions)
            {
                const requiredOptions = dbLoadboardNames[lbName].requiredFields;
            }
        }
        if (errors.length !== 0)
        {
            throw errors;
        }
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
     */
    static registerLoadboardStatusManager(loadboardPosts, orderGuid, userGuid, statusId)
    {
        const loadboardNames = LoadboardService.getLoadboardNames(loadboardPosts);
        return StatusManagerHandler.registerStatus({
            orderGuid,
            userGuid,
            statusId,
            extraAnnotations: { 'loadboards': loadboardNames }
        });
    }
}

module.exports = LoadboardService;