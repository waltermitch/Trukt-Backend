const Knex = require('knex');
const knexfile = require('../../knexfile');
const loadboardClasses = require('../Loadboards/LoadboardsList');
const LoadboardService = require('../Services/LoadboardService');
const OrderJobDispatch = require('../Models/OrderJobDispatch');

const { ServiceBusClient } = require('@azure/service-bus');

const connectionString = process.env['azure.servicebus.loadboards.connectionString'];
const topicName = 'loadboard_incoming';
const sbClient = new ServiceBusClient(connectionString);
const receiver = sbClient.createReceiver(topicName, process.env['azure.servicebus.loadboards.subscription.to']);

const pubsub = require('../Azure/PubSub');

const myMessageHandler = async (message) =>
{
    const responses = message.body;
    const jobGuid = responses[0].payloadMetadata.post.jobGuid;

    for (const res of responses)
    {
        const lbClass = loadboardClasses[`${res.payloadMetadata.loadboard}`];

        try
        {
            // make the first letter of the action uppercase so that we can call the the loadboards action
            // handler based off this string i.e post -> Post to be handled by method handlePost
            const action = res.payloadMetadata.action.charAt(0).toUpperCase() + res.payloadMetadata.action.slice(1);
            await lbClass[`handle${action}`](res.payloadMetadata, res[`${res.payloadMetadata.action}`]);
        }
        catch (e)
        {
            throw new Error(e.toString());
        }
    }

    // publish to a group that is named after the the jobGuid which
    // should be listening on messages posted to the group
    if (responses[0].payloadMetadata.action == 'dispatch' || responses[0].payloadMetadata.action == 'undispatch')
    {
        const dispatch = await OrderJobDispatch.query().withGraphJoined('[vendor, vendorAgent]').findOne({ jobGuid });
        await pubsub.publishToGroup(`${jobGuid}`, { object: 'dispatch', data: { dispatch } });
    }
    else
    {
        const posts = await LoadboardService.getAllLoadboardPosts(jobGuid);
        await pubsub.publishToGroup(`${jobGuid}`, { object: 'posting', data: { posts } });
    }
};
const myErrorHandler = async (args) =>
{
    console.log(
        `Error occurred with ${args.entityPath} within ${args.fullyQualifiedNamespace}: `,
        args.error
    );
};

receiver.subscribe({
    processMessage: myMessageHandler,
    processError: myErrorHandler
});
