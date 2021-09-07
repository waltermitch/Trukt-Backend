const Knex = require('knex');
const knexfile = require('../../knexfile');
const loadboardClasses = require('../Loadboards/LoadboardsList');
const LoadboardService = require('../Services/LoadboardService');

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
        await lbClass[`handle${res.payloadMetadata.action}`](res.payloadMetadata.post, res[`${res.payloadMetadata.action}`]);
    }

    const posts = await LoadboardService.getAllLoadboardPosts(jobGuid);

    // publish to a group that is named after the the jobGuid which
    // should be listening on messages posted to the group
    await pubsub.publishToGroup(`${jobGuid}`, { object: 'posting', data: { posts } });
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
