const OrderJobService = require('../Services/OrderJobService');
const PubSubService = require('../Services/PubSubService');
const OrderService = require('../Services/OrderService');
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

module.exports = listener;
