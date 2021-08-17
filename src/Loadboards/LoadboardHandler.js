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

const myMessageHandler = async (message) =>
{
    // your code here
    const responses = message.body;

    const trx = await LoadboardPost.startTransaction();
    const posts = [];

    // console.log(responses);
    for (const res of responses)
    {
        const lbClass = loadboardClasses[`${res.payloadMetadata.loadboard}`];
        console.log('action ', res.payloadMetadata.action);

        await lbClass[`handle${res.payloadMetadata.action}`](res.payloadMetadata.post, res[`${res.payloadMetadata.action}`]);

        const objectionPost = LoadboardPost.fromJson(res.payloadMetadata.post);
        console.log(objectionPost);
        await LoadboardPost.query().patch(objectionPost).findById(objectionPost.id);
        posts.push(objectionPost);
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
