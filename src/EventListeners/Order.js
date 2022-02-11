const ActivityManagerService = require('../Services/ActivityManagerService');
const LoadboardService = require('../Services/LoadboardService');
const OrderService = require('../Services/OrderService');
const OrderJob = require('../Models/OrderJob');
const listener = require('./index');

listener.on('order_updated', ({ oldOrder, newOrder }) =>
{
    setImmediate(async () =>
    {
        const dispatchesToUpdate = LoadboardService.updateDispatchPrice(newOrder.jobs);
        const proms = await Promise.allSettled([OrderService.validateStopsBeforeUpdate(oldOrder, newOrder), newOrder.jobs.map(async (job) => await LoadboardService.updatePostings(job.guid).catch(err => console.log(err))), ...dispatchesToUpdate]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('order_created', (orderGuid) =>
{
    // set Immediate make the call async
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.calculatedDistances(orderGuid), createSuperOrders(orderGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('order_client_notes_updated', (orderGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([getJobGuids(orderGuid).then(jobGuids => jobGuids.map(jobGuid => LoadboardService.updatePostings(jobGuid.guid)))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('order_ready', ({ orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
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
                statusId: 28
            })
        ]);
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
                statusId: 30
            })
        ]);
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
                statusId: 8
            })
        ]);
    });

    // for (const p of proms)
    //     if (p.status === 'rejected')
    //         console.log(p.reason?.response?.data || p.reason);
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
                statusId: 9
            })
        ]);
    });

    // for (const p of proms)
    //     if (p.status === 'rejected')
    //         console.log(p.reason?.response?.data || p.reason);
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