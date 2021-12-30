const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const OrderJobService = require('../Services/OrderJobService');
const PubSubService = require('../Services/PubSubService');
const OrderService = require('../Services/OrderService');
const StatusLog = require('../Models/StatusLog');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const listener = require('./index');
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');

const SYSUSER = process.env.SYSTEM_USER;

listener.on('orderjob_stop_update', (jobGuid, currentUser) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderJobService.updateStatusField(jobGuid, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_accepted', ({ jobGuid, dispatcherGuid, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsScheduled(orderGuid, dispatcherGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_canceled', ({ jobGuid, dispatcherGuid, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, dispatcherGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_declined', ({ jobGuid, dispatcherGuid, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, dispatcherGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_canceled', ({ jobGuid, dispatcherGuid, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, dispatcherGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_delivered', ({ jobGuid, dispatcherGuid = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderService.markOrderDelivered(orderGuid, dispatcherGuid, jobGuid),
            StatusManagerHandler.registerStatus({
                orderGuid,
                jobGuid,
                userGuid: dispatcherGuid,
                statusId: 27
            })
        ]);

        // Log the reason why the order was not set as delivered
        for (const p of proms)
            if (p.status === 'rejected')
                console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_undelivered', ({ jobGuid, dispatcherGuid = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markOrderUndelivered(orderGuid, dispatcherGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_picked_up', ({ jobGuid, dispatcherGuid = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderService.markOrderUndelivered(orderGuid, dispatcherGuid, jobGuid),
            StatusManagerHandler.registerStatus({
                orderGuid,
                jobGuid,
                userGuid: dispatcherGuid,
                statusId: 29
            })
        ]);

        // Log the reason why the order was not set as pick up
        for (const p of proms)
            if (p.status === 'rejected')
                console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_status_updated', ({ jobGuid, currentUser, state }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([(PubSubService.jobUpdated(jobGuid, { currentUser, status: state.status }))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_booked', ({ jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([(OrderJobService.updateStatusField(jobGuid, currentUser))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_deleted', async ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        const [jobsOrder] = await OrderJob.query().modify('areAllOrderJobsDeleted', orderGuid);
        if (jobsOrder?.deleteorder)
        {
            const deleteStatusPayload = Order.createStatusPayload(userGuid).deleted;
            await Promise.allSettled([
                Order.query().patch(deleteStatusPayload).findById(orderGuid),

                // Register order deleted
                StatusManagerHandler.registerStatus({
                    orderGuid,
                    jobGuid,
                    userGuid,
                    statusId: 19
                })
            ]);
        }

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_undeleted', async ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        // Register order undeleted
        await Promise.allSettled([
            StatusManagerHandler.registerStatus({
                orderGuid,
                jobGuid,
                userGuid,
                statusId: 20
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_activity_updated', ({ jobGuid, state }) =>
{
    setImmediate(async () =>
    {
        const currentActivity = await StatusLog.query().select([
            'id',
            'orderGuid',
            'dateCreated',
            'extraAnnotations',
            'jobGuid'
        ])
            .findById(state.id)
            .withGraphFetched({ user: true, status: true })
            .modifyGraph('status', builder => builder.select('id', 'name'))
            .andWhere('jobGuid', jobGuid);

        console.log('Current Activity', currentActivity);

        const proms = await Promise.allSettled([(PubSubService.jobActivityUpdate(jobGuid, currentActivity))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

module.exports = listener;
