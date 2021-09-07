const Loadboard = require('../Models/Loadboard');
const LoadboardPost = require('../Models/LoadboardPost');
const LoadboardContact = require('../Models/LoadboardContact');
const Job = require('../Models/OrderJob');

const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const loadboardClasses = require('../Loadboards/LoadboardsList');

const { ServiceBusClient } = require('@azure/service-bus');

const connectionString = process.env['azure.servicebus.loadboards.connectionString'];
const queueName = 'loadboard_posts_outgoing';
const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(queueName);

let currentUserGuid = '00000000-0000-0000-0000-000000000000';
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
            bills.lines.item,
            dispatcher
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        await this.createPostRecords(job, posts);
        this.combineCommoditiesWithLines(job.commodities, job.order.invoices[0], 'invoice');
        delete job.order.invoices;
        this.combineCommoditiesWithLines(job.commodities, job.bills[0], 'bill');
        delete job.bills;
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

        // return [stops[0], stops[stops.length - 1]];
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