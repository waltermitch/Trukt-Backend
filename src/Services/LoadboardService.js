/* eslint-disable */
require("../../local.settings");
const Loadboard = require('../Models/Loadboard');
const LoadboardPost = require('../Models/LoadboardPost');
const Job = require('../Models/OrderJob');
const SFAccount = require('../Models/SFAccount');
const LoadboardHandler = require('../Loadboards/LoadboardHandler');

const loadboardClasses = require('../Loadboards/LoadboardsList');

const { ServiceBusClient } = require("@azure/service-bus");
const connectionString = process.env["rcgqueue.loadboards.connectionString"];
const queueName = "loadboard_posts_outgoing";
const sbClient = new ServiceBusClient(connectionString);
const sender = sbClient.createSender(queueName);

const createdByGuid = '00000000-0000-0000-0000-000000000000';
let dbLoadboardNames;

(async function ()
{
    dbLoadboardNames = (await Loadboard.query()).reduce((acc, curr) => (acc[curr.name] = curr, acc), {});
})();

class LoadboardService
{
    static async createPostings(jobId, lbNames, options)
    {
        //LoadboardService.intializeLoadboards();
        console.log('creating posts');
        const job = await LoadboardService.getAllPostingData(jobId, lbNames, options);
        let lbClass = {};
        for (const lbName of lbNames)
        {
            lbClass = LoadboardService.chooseLoadboard(lbName, job);
            this[`${lbName}_Requests`].push({ 'func': 'create', 'class': lbClass });
        }

        return job;
    }

    static async postPostings(jobId, posts)
    {
        const job = await LoadboardService.getAllPostingData(jobId, posts);

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
        await sender.sendMessages({ body: payloads });
        return payloads;
    }

    static async unpostPostings(jobId, posts)
    {
        const job = await LoadboardService.getPostRecords(jobId, posts);

        const payloads = [];
        let lbPayload;
        for (const post of posts)
        {
            lbPayload = new loadboardClasses[`${post.loadboard}`](job);
            payloads.push(lbPayload['unpost']());
        }
        // sending all payloads as one big object so one big response can be returned
        // and handler can then use one big transaction to update all records rather 
        // than have a single new transaction for each posting
        await sender.sendMessages({ body: payloads });
        return job;
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

        //console.log(payloads);
        await sender.sendMessages({ body: payloads });
        return payloads;
    }

    // This method gets all the job information and creates new post records based on the posts
    // list that is sent in if needed
    static async getAllPostingData(jobId, posts)
    {
        const loadboardNames = posts.map((post) => { return post.loadboard });
        const job = await Job.query().findById(jobId).withGraphFetched(`[
            commodities(distinct).[vehicle, commType], order.[client, clientContact, owner],
            stops(distinct).[primaryContact, terminal], loadboardPosts(getExistingFromList),
            equipmentType
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });

        // const dispatcher = await SFAccount.query().findById(job.order.owner);
        // job.order.dispatcher = dispatcher;

        await this.createPostRecords(job, posts);
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
        const loadboardNames = posts.map((post) => { return post.loadboard });
        //console.log(jobId);
        const job = await Job.query().findById(jobId).withGraphFetched(`[
            loadboardPosts(getExistingFromList)
        ]`).modifiers({
            getExistingFromList: builder => builder.modify('getFromList', loadboardNames)
        });
        //console.log(job);
        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});
        delete job.loadboardPosts;
        return job;
    }

    //This method is for getting all existing data for the job 
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

    static convertPostListToObject(loadboardPosts)
    {
        const postObjects = {};
        for (const post of loadboardPosts)

            postObjects[post.loadboard] = post;

        return postObjects;
    }

    static async createPostRecordsNew(job, posts)
    {
        let newPosts = [];
        job.postObjects = job.loadboardPosts.reduce((acc, curr) => (acc[curr.loadboard] = curr, acc), {});
        for (const post of posts)
        {
            if (!(post.loadboard in job.postObjects))
            {
                newPosts.push({
                    jobGuid: job.guid,
                    loadboard: post.loadboard,
                    instructions: post.loadboardInstructions || job.loadboardInstructions,
                    values: post.values,
                    createdByGuid
                });
            } else
            {
                job.postObjects[`${post.loadboard}`] = await LoadboardPost.query().patchAndFetchById(job.postObjects[`${post.loadboard}`].id, {
                    id: job.postObjects[`${post.loadboard}`].id,
                    jobGuid: job.guid,
                    loadboard: post.loadboard,
                    instructions: post.loadboardInstructions || job.loadboardInstructions,
                    is_synced: false,
                    values: post.values,
                });
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

    static checkLoadboardsParam(loadboardNames)
    {
        for (let i = 0; i < loadboardNames.length; i++)
            if (!dbLoadboardNames.includes(loadboardNames[i]))

                throw `the loadboard: ${loadboardNames[i]} is not supported`;

    }

    static checkLoadboardsInput(req)
    {
        let loadboardNames = req.loadboards;
        let errors = [];
        if (loadboardNames.length === 0)
        {
            const data = {
                message: `a loadboard is required in order to post, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`
            };
            errors.push(data);
        }
        for (let i = 0; i < loadboardNames.length; i++)
        {
            let lbName = loadboardNames[i];
            if (!(lbName in dbLoadboardNames))
            {
                const data = {
                    message: `the loadboard: ${loadboardNames[i]} is not supported, 
            here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`
                };
                throw data;
            }
            if (dbLoadboardNames[lbName].requiresOptions)
            {
                if (!(lbName in req))
                {
                    const data = {
                        message: `HEY ${lbName} REQUIRES OPTIONS`
                    }
                    errors.push(data);
                } else
                {
                    let post = req[lbName];
                    const missing = [];
                    const required = dbLoadboardNames[lbName].requiredFields.requiredFields;
                    for (const requiredField of required) 
                    {
                        if (!(requiredField in post))
                        {
                            missing.push(requiredField);
                        }
                    }
                    if (missing.length != 0) 
                    {
                        const data = {
                            message: `HEY ${lbName} REQUIRES ${missing}`
                        }
                        errors.push(data);
                    }

                }
            }
        }
        if (errors.length !== 0)
        {
            throw errors;
        }
        console.log('looks good');
    }

    static checkLoadboardsInputNew(posts)
    {
        let errors = [];
        if (posts.length === 0)
        {
            const data = {
                message: `a loadboard is required in order to post, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`
            };
            errors.push(data);
        }
        for (const post of posts)
        {
            const lbName = post.loadboard;
            if (!(lbName in dbLoadboardNames))
            {
                const data = {
                    message: `the loadboard: ${post.loadboard} is not supported, here are our supported loadboards: ${Object.keys(dbLoadboardNames)}`
                };
                throw data;
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
        console.log('ayyy looking good');
    }

    // recieves all the stops for a job and returns the first and last stops based on stop sequence
    static async getFirstAndLastStops(stops)
    {
        stops.sort((stop1, stop2) =>
        {
            return stop1.sequence - stop2.sequence;
        });

        //return [stops[0], stops[stops.length - 1]];
        return { pickup: stops[0], delivery: stops[stops.length - 1] };
    }

    // static chooseLoadboard(BoardName, payload)
    // {
    //     let res = {};
    //     switch (BoardName)
    //     {
    //         case 'SUPERDISPATCH':
    //             res = new loadboardClasses.SD(payload);
    //     }

    //     return res;
    // }

    // static intializeLoadboards()
    // {
    //     for (const lbName of dbLoadboardNames)
    //     {
    //         this[`${lbName}_Requests`] = [];
    //         this[`${lbName}`] = [];
    //     }
    // }

    /**
     *
     * @param {*} loadboardPosts a list of a jobs loadboard posts
     */
    filterToCreate(loadboardPosts)
    {
        const retPosts = [];
        for (const post of loadboardPosts)
            if (!post.hasError && post.isSynced && (post.isCreated == null || !post.isCreated))

                retPosts.push(post);

        return retPosts;
    }

    filterToUnpost(loadboardPosts)
    {
        const retPosts = [];
        for (const post of loadboardPosts)
            if (!post.hasError && post.isSynced && post.isCreated && post.isPosted)

                retPosts.push(post);

        return retPosts;
    }

    filterToRepost(loadboardPosts)
    {
        return this.filterToUnpost(loadboardPosts);
    }

    desync(loadboardPosts)
    {
        for (const post of loadboardPosts)

            post.isSynced = false;

    }
}

module.exports = LoadboardService;