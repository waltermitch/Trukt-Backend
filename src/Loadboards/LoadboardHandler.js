const LoadboardPost = require('../Models/LoadboardPost');
const Knex = require('knex');
const knexfile = require('../../knexfile');
const loadboardClasses = require('../Loadboards/LoadboardsList');

const knex = Knex(knexfile());

const { ServiceBusClient } = require('@azure/service-bus');

const connectionString = process.env['rcgqueue.loadboards.connectionString'];
const queueName = 'loadboard_posts_incoming';
const sbClient = new ServiceBusClient(connectionString);
const receiver = sbClient.createReceiver(queueName);

const pubsub = require('../Azure/PubSub');

const myMessageHandler = async (message) =>
{
    const responses = message.body;
    const posts = [];
    
    for (const res of responses)
    {
        const lbClass = loadboardClasses[`${res.payloadMetadata.loadboard}`];
        const post = await lbClass[`handle${res.payloadMetadata.action}`](res.payloadMetadata.post, res[`${res.payloadMetadata.action}`]);

        posts.push(post);
    }

    // publish to a group that is named after the the jobGuid which
    // should be listening on messages posted to the group
    await pubsub.publishToGroup(`${posts[0].jobGuid}`, posts);
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
