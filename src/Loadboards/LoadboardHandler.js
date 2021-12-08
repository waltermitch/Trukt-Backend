const loadboardClasses = require('../Loadboards/LoadboardsList');
const LoadboardService = require('../Services/LoadboardService');
const OrderJob = require('../Models/OrderJob');
const R = require('ramda');
const { delay, isServiceBusError, ServiceBusClient } = require('@azure/service-bus');

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
                pubsubAction == 'undispatch' ||
                pubsubAction == 'carrierAcceptDispatch' ||
                pubsubAction == 'carrierDeclineDispatch')
            {
                const job = await OrderJob.query().leftJoinRelated('vendor').leftJoinRelated('vendorAgent')
                    .findOne({ 'rcgTms.orderJobs.guid': jobGuid })
                    .select(
                        'rcgTms.OrderJobs.status as jobStatus',
                        'vendor.name as vendorName',
                        'vendor.dotNumber',
                        'vendor.email as vendorEmail',
                        'vendor.phoneNumber as vendorPhone',
                        'vendorAgent.name as agentName',
                        'vendorAgent.email as agentEmail',
                        'vendorAgent.phoneNumber as agentPhone');

                await pubsub.publishToGroup(jobGuid, { object: 'dispatch', data: { job } });
            }
            else
            {
                const posts = await LoadboardService.getAllLoadboardPosts(jobGuid);

                // this loops through all the posts and returns true as soon as
                // it finds that one of the loadboards is marked as posted
                const isPosted = R.any(post => post.posted())(Object.values(posts));
                const status = isPosted ? 'posted' : 'ready';

                // Objection returns the number of rows affected by a query
                // so that means if this query really did change the status, then
                // add the changed status to the pubsub message.
                // If the job status is in pending, picked up, or delivered,
                // then the status should not be updated and the message listener should
                // not need a status update, otherwise the new status will be sent.
                const numOfJobsAffected = await OrderJob.query()
                .patch({ status })
                .findById(jobGuid)
                .whereNotIn('status', ['pending', 'picked up', 'delivered']);
                const messagePayload = { posts };
                if(numOfJobsAffected > 0)
                {
                    messagePayload.status = status;
                }

                await pubsub.publishToGroup(jobGuid, { object: 'posting', data: { messagePayload } });
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
