const { delay, isServiceBusError, ServiceBusClient } = require('@azure/service-bus');
const loadboardClasses = require('../Loadboards/LoadboardsList');
const LoadboardService = require('../Services/LoadboardService');
const OrderJobService = require('../Services/OrderJobService');
const PicklistService = require('../Services/PicklistService');
const knex = require('../Models/BaseModel').knex();
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const R = require('ramda');

const connectionString = process.env['azure.servicebus.loadboards.connectionString'];
const topicName = 'loadboard_incoming';
const sbClient = new ServiceBusClient(connectionString);
const receiver = sbClient.createReceiver(topicName, process.env['azure.servicebus.loadboards.subscription.to']);

const pubsub = require('../Azure/PubSub');

const myMessageHandler = async (message) =>
{
    const responses = message.body;
    let jobGuid;
    try
    {
        for (const res of responses)
        {
            // for some reason, service bus is sending over empty objects and is completely throwing
            // this handler off, so until we find why service bus is sending over empty objects,
            // we will have to check if the object is empty
            if (!R.isEmpty(res))
            {
                const lbClass = loadboardClasses[`${res.payloadMetadata.loadboard}`];

                try
                {
                    // make the first letter of the action uppercase so that we can call the the loadboards action
                    // handler based off this string i.e post -> Post to be handled by method handlePost
                    const action = res.payloadMetadata.action.charAt(0).toUpperCase() + res.payloadMetadata.action.slice(1);
                    jobGuid = await lbClass[`handle${action}`](res.payloadMetadata, res[`${res.payloadMetadata.action}`]);
                }
                catch (e)
                {
                    throw new Error(e.toString());
                }
            }
        }

        if (jobGuid)
        {
            const pubsubAction = responses[0].payloadMetadata.action;

            // publish to a group that is named after the the jobGuid which
            // should be listening on messages posted to the group
            if (
                pubsubAction == 'dispatch' ||
                pubsubAction == 'carrierAcceptDispatch')
            {
                const job = await OrderJobDispatch.query()
                    .withGraphJoined('[vendor, vendorAgent]')
                    .modifyGraph('vendor', builder =>
                    {
                        builder.select(
                            'dotNumber',
                            'email',
                            'phoneNumber',
                            'billingStreet',
                            'billingCity',
                            'billingPostalCode',
                            'billingState',
                            'billingCountry');
                    })
                    .modifyGraph('vendorAgent', builder =>
                    {
                        builder.select(
                            'name',
                            'email',
                            'phoneNumber');
                    })
                    .leftJoinRelated('job')
                    .select(
                        'orderJobDispatches.guid as dispatchGuid',
                        'job.guid as jobGuid',
                        'job.status'
                    ).findOne({ 'jobGuid': jobGuid, isValid: true })
                    .andWhere(builder => builder.where({ isPending: true }).orWhere({
                        isAccepted: true
                    }));

                // we need to get the stops that are associated with this dispatch
                // and since jobs and stops have a weird relationship, it is easier to do
                // a raw query that gets the data.
                const stops = (await knex.raw(`
                        select distinct(os.guid), os.stop_type, os.date_scheduled_type, os.date_scheduled_start, os.date_scheduled_end, os.sequence
                        from rcg_tms.order_job_dispatches ojd 
                        left join rcg_tms.order_stop_links osl 
                        on ojd.job_guid = osl.job_guid
                        left join rcg_tms.order_stops os 
                        on osl.stop_guid = os.guid 
                        where ojd.guid = ?
                        and (os.stop_type = 'pickup' or os.stop_type = 'delivery')
                        and os.date_scheduled_type is not null order by os.sequence;`, [job.dispatchGuid])).rows;

                // postgres does not do camel case so we need to transform all the keys
                // to camel case
                for (const stop of stops)
                {
                    for (const key of Object.keys(stop))
                    {
                        const k = PicklistService.cleanUpSnakeCase(key);
                        if (k == key)
                            continue;
                        stop[k] = stop[key];
                        delete stop[key];
                    }
                }

                job.pickup = stops[0];
                job.delivery = stops[1];

                await pubsub.publishToGroup(jobGuid, { object: 'dispatch', data: { job } });
            }
            if (pubsubAction == 'undispatch' ||
                pubsubAction == 'carrierDeclineDispatch')
            {
                const job = (await OrderJobDispatch.query()
                    .leftJoinRelated('job')
                    .select(
                        'job.guid as jobGuid',
                        'job.status'
                    ).where({ 'jobGuid': jobGuid })
                    .andWhere(builder =>
                        builder.where({ 'orderJobDispatches.isCanceled': true })
                            .orWhere({ isDeclined: true }))
                    .limit(1))[0];
                if (job)
                {
                    job.vendor = {
                        dotNumber: null,
                        email: null,
                        phone: null,
                        billingStreet: null,
                        billingCity: null,
                        billingPostalCode: null,
                        billingState: null,
                        billingCountry: null
                    };
                    job.vendorAgent = {
                        name: null,
                        email: null,
                        phone: null
                    };
                    job.pickup = { datedScheduledType: null, dateScheduledStart: null, dateScheduledEnd: null };
                    job.delivery = { datedScheduledType: null, dateScheduledStart: null, dateScheduledEnd: null };
                }

                await pubsub.publishToGroup(jobGuid, { object: 'dispatch', data: { job } });
            }
            else
            {
                // getting status field by current state data is in, and active post that belongs to the post
                const [{ value: status, reason: error }, posts] = await Promise.allSettled([OrderJobService.updateStatusField(jobGuid), LoadboardService.getAllLoadboardPosts(jobGuid)]);

                if (!status)
                    throw error;

                // publishing status and post to posting group
                await pubsub.publishToGroup(jobGuid, { object: 'posting', data: { posts, status } });
            }

        }
    }
    catch (e)
    {
        await receiver.completeMessage(message);
    }
};

const myErrorHandler = async (args) =>
{

    console.log(
        `Error occurred with ${args.entityPath} within ${args.fullyQualifiedNamespace}: `,
        args.error
    );

    // the `subscribe() call will not stop trying to receive messages without explicit intervention from you.
    if (isServiceBusError(args.error))
    {
        switch (args.error.code)
        {
            case 'MessagingEntityDisabled':
            case 'MessagingEntityNotFound':
            case 'UnauthorizedAccess':
                // It's possible you have a temporary infrastructure change (for instance, the entity being
                // temporarily disabled). The handler will continue to retry if `close()` is not called on the subscription - it is completely up to you
                // what is considered fatal for your program.
                console.log(
                    `An unrecoverable error occurred. Stopping processing. ${args.error.code}`,
                    args.error
                );
                await subscription.close();
                break;
            case 'MessageLockLost':
                console.log('Message lock lost for message', args.error);
                break;
            case 'ServiceBusy':
                // choosing an arbitrary amount of time to wait.
                await delay(1000);
                break;
        }
    }
    else
    {
        const messages = await receiver.receiveMessages(1);
        for (const message of messages)
        {
            console.log(` Message: '${message.body}'`);

            // completing the message will remove it from the remote queue or subscription.
            await receiver.completeMessage(message);
        }
    }
};

const subscription = receiver.subscribe({
    processMessage: myMessageHandler,
    processError: myErrorHandler
});
