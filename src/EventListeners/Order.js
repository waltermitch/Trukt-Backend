const ActivityManagerService = require('../Services/ActivityManagerService');
const LoadboardService = require('../Services/LoadboardService');
const OrderService = require('../Services/OrderService');
const OrderJob = require('../Models/OrderJob');
const listener = require('./index');
const eventLogErrors = require('./eventLogErrors');

listener.on('order_updated', ({ oldOrder, newOrder }) =>
{
    setImmediate(async () =>
    {
        const dispatchesToUpdate = LoadboardService.updateDispatchPrice(newOrder.jobs);
        const proms = await Promise.allSettled([OrderService.validateStopsBeforeUpdate(oldOrder, newOrder), newOrder.jobs.map(async (job) => await LoadboardService.updatePostings(job.guid).catch(err => console.log(err))), ...dispatchesToUpdate]);
        
        eventLogErrors(proms, 'order_updated');
    });
});

listener.on('order_created', (orderGuid) =>
{
    // set Immediate make the call async
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.calculatedDistances(orderGuid), createSuperOrders(orderGuid)]);

        eventLogErrors(proms, 'order_created');
    });
});

listener.on('order_client_notes_updated', (orderGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([getJobGuids(orderGuid).then(jobGuids => jobGuids.map(jobGuid => LoadboardService.updatePostings(jobGuid.guid)))]);
        
        eventLogErrors(proms, 'order_client_notes_updated');
    });
});

listener.on('order_ready', ({ orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([]);

        eventLogErrors(proms, 'order_ready');
    });
});

listener.on('order_delivered', ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createAvtivityLog({
                orderGuid,
                jobGuid,
                userGuid,
                activityId: 28
            })
        ]);

        eventLogErrors(proms, 'order_delivered');
    });
});

listener.on('order_undelivered', ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createAvtivityLog({
                orderGuid,
                jobGuid,
                userGuid,
                activityId: 30
            })
        ]);

        eventLogErrors(proms, 'order_undelivered');
    });
});

listener.on('tender_accepted', ({ jobGuid, orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createAvtivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 8
            })
        ]);

        eventLogErrors(proms, 'tender_accepted');
    });

});

listener.on('tender_rejected', ({ jobGuid, orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createAvtivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 9
            })
        ]);

        eventLogErrors(proms, 'tender_rejected');
    });
});

async function createSuperOrders(orderGuid)
{
    const jobsToPost = await OrderService.getTransportJobsIds(orderGuid);

    await Promise.allSettled(jobsToPost?.map(({ guid, createdByGuid }) =>
        LoadboardService.createPostings(guid, [{ loadboard: 'SUPERDISPATCH' }], createdByGuid)
    ));
}

async function getJobGuids(orderGuid)
{
    const jobs = await OrderJob.query().select('guid').where('orderGuid', orderGuid);

    return jobs;
}

module.exports = listener;