const ActivityManagerService = require('../Services/ActivityManagerService');
const LoadboardService = require('../Services/LoadboardService');
const OrderService = require('../Services/OrderService');
const logEventErrors = require('./logEventErrors');
const OrderJob = require('../Models/OrderJob');
const listener = require('./index');

listener.on('order_updated', ({ oldOrder, newOrder }) =>
{
    setImmediate(async () =>
    {
        const dispatchesToUpdate = LoadboardService.updateDispatchPrice(newOrder.jobs);
        const proms = await Promise.allSettled([OrderService.validateStopsBeforeUpdate(oldOrder, newOrder), newOrder.jobs.map(async (job) => await LoadboardService.updatePostings(job.guid).catch(err => console.log(err))), ...dispatchesToUpdate]);

        logEventErrors(proms, 'order_updated');
    });
});

listener.on('order_created', (orderGuid) =>
{
    // set Immediate make the call async
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.calculatedDistances(orderGuid), createSuperOrders(orderGuid)]);

        logEventErrors(proms, 'order_created');
    });
});

listener.on('order_client_notes_updated', (orderGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([getJobGuids(orderGuid).then(jobGuids => jobGuids.map(jobGuid => LoadboardService.updatePostings(jobGuid.guid)))]);

        logEventErrors(proms, 'order_client_notes_updated');
    });
});

listener.on('order_ready', ({ orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([]);

        logEventErrors(proms, 'order_ready');
    });
});

listener.on('order_delivered', ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid,
                jobGuid,
                userGuid,
                activityId: 28
            })
        ]);

        logEventErrors(proms, 'order_delivered');
    });
});

listener.on('order_undelivered', ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid,
                jobGuid,
                userGuid,
                activityId: 30
            })
        ]);

        logEventErrors(proms, 'order_undelivered');
    });
});

listener.on('tender_accepted', ({ jobGuid, orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 8
            })
        ]);

        logEventErrors(proms, 'tender_accepted');
    });

});

listener.on('tender_rejected', ({ jobGuid, orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 9
            })
        ]);

        logEventErrors(proms, 'tender_rejected');
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