const LoadboardPost = require('../Models/LoadboardPost');
const Knex = require('knex');
const knexfile = require('../../knexfile');

const knex = Knex(knexfile());

const { ServiceBusClient } = require('@azure/service-bus');

const connectionString = process.env['rcgqueue.loadboards.connectionString'];
const queueName = 'loadboard_posts_incoming';
const sbClient = new ServiceBusClient(connectionString);
const receiver = sbClient.createReceiver(queueName);

const myMessageHandler = async (message) =>
{
    // your code here
    const res = message.body;

    // console.log(res.response);
    console.log(res.payloadMetadata);
    delete res.payloadMetadata.loadboard;
    await LoadboardPost.query().update(res.payloadMetadata.post).where('id', res.payloadMetadata.post.id);

    // console.log(`message.body: ${res.pickup.venue.name}`);
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

// class LoadboardHandler
// {

//     constructor() { }
//     static async receiver()
//     {
//         const dequeueResponse = await receiver.receiveMessages();
//         console.log(dequeueResponse);
//     }

//     static handleCreate(job, response)
//     {
//         console.log('this is where creations would be handled ');
//         knex.transaction(trx =>
//         {
//             const queries = [];

//             for (const [lbName, post] of Object.entries(job.postObjects))
//             {
//                 const query = knex('loadboard_posts').where('id', post.id).update({
//                     status: 'posted',
//                     is_posted: true,
//                     is_synced: true
//                 }).transacting(trx);
//                 queries.push(query);
//             }
//             Promise.all(queries).then(trx.commit);
//         });
//     }

//     static handlePost(job, response)
//     {
//         console.log('this is handling posting');

//         console.log(response.value.data.data);
//         const sdVehicles = response.value.vehicles;
//         knex.transaction(trx =>
//         {
//             const queries = [];
//             for (const [lbName, post] of Object.entries(job.postObjects))
//             {
//                 const query = knex('loadboard_posts').where('id', post.id).update({
//                     status: 'posted',
//                     is_posted: true,
//                     is_synced: true,
//                     external_post_guid: post.external_guid
//                 }).transacting(trx);
//                 queries.push(query);
//             }
//             job.commodities = this.updateCommodity(job.commodities, sdVehicles);
//             for (const com of job.commodities)
//             {
//                 const query = knex('commodities').where('guid', com.guid).update(com).transacting(trx);
//                 queries.push(query);
//             }
//             Promise.all(queries).then(trx.commit);
//         });

//         // console.log(job.postObjects);
//     }

//     static handleUnpost(postObjects, promise)
//     {
//         console.log('the load has been unposted');

//         knex.transaction(trx =>
//         {
//             console.log('THIS IS INSIDE THE TRANSACTION');
//             const queries = [];
//             for (const [lbName, post] of Object.entries(postObjects))
//             {
//                 const query = knex('loadboard_posts').where('id', post.id).update({
//                     status: 'unposted',
//                     is_posted: false,
//                     is_synced: true
//                 }).transacting(trx);
//                 queries.push(query);
//             }
//             Promise.all(queries).then(trx.commit);
//         });

//     }

//     handleUpdate(job)
//     {

//     }

//     handleRepost(job)
//     {

//     }

//     handleDelete(job)
//     {

//     }

//     static updateCommodity(ogCommodities, newCommodities)
//     {
//         // const commodityObject = {};
//         // for (const commodity of ogCommodities)

//         //     // console.log(commodity);
//         //     commodityObject[commodity.identifier + ' ' + commodity.name] = commodity;

//         // for (const commodity of newCommodities)
//         // {
//         //     const comName = commodity.vin + ' ' + commodity.year + ' ' + commodity.make + ' ' + commodity.model;
//         //     const ourCom = commodityObject[comName];
//         //     const externalValues = { sdGuid: commodity.guid };
//         //     const newCom = { guid: ourCom.guid, extra_external_data: externalValues };
//         //     console.log(newCom);

//         //     // ourCom.extra_external_data = externalValues;
//         // }

//         const comsToUpdate = [];

//         while (ogCommodities.length !== 0)
//         {
//             let com = ogCommodities.shift();

//             if (com.extraExternalData === null)
//             {

//                 com = this.commodityUpdater(com, newCommodities);
//                 comsToUpdate.push(com);
//             }
//         }

//         return comsToUpdate;
//     }

//     static commodityUpdater(com, newCommodities)
//     {

//         for (let i = 0; i < newCommodities.length; i++)
//         {
//             const commodity = newCommodities[i];
//             const newName = commodity.vin + ' ' + commodity.year + ' ' + commodity.make + ' ' + commodity.model;
//             const comName = com.identifier + ' ' + com.name;
//             if (comName === newName)
//             {
//                 const extraExternalData = { sdGuid: commodity.guid };
//                 com.extraExternalData = extraExternalData;
//                 newCommodities.shift(i);
//                 return { guid: com.guid, extraExternalData };

//                 // break;
//             }
//         }

//         return com;
//     }
// }

// module.exports = LoadboardHandler;