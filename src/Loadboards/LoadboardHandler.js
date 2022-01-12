const { delay, isServiceBusError, ServiceBusClient } = require('@azure/service-bus');
const loadboardClasses = require('../Loadboards/LoadboardsList');
const LoadboardService = require('../Services/LoadboardService');
const OrderJobService = require('../Services/OrderJobService');
const R = require('ramda');
const PubSubService = require('../Services/PubSubService');

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

            switch (pubsubAction)
            {
                case 'dispatch':
                case 'carrierAcceptDispatch':
                case 'undispatch':
                case 'carrierDeclineDispatch':
                    const jobPayload = await LoadboardService.getJobDispatchData(jobGuid);
                    await Promise.allSettled([PubSubService.jobUpdated(jobGuid, jobPayload)]);
                    break;
                case 'post':
                case 'unpost':
                case 'update':
                default:
                    // getting status field by current state data is in, and active post that belongs to the post
                    const [{ value: status, reason: error }, posts] = await Promise.allSettled([OrderJobService.updateStatusField(jobGuid), LoadboardService.getAllLoadboardPosts(jobGuid)]);

                    if (!status)
                        throw error;

                    // since the status update message is being sent in the updateStatusField function called earlier,
                    // we just need to send the updated posts
                    PubSubService.publishJobPostings(jobGuid, posts.value);
                    break;

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
