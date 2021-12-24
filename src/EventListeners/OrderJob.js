const OrderJobService = require('../Services/OrderJobService');
const OrderService = require('../Services/OrderService');
const { EventEmitter } = require('events');

const SYSUSER = process.env.SYSTEM_USER;
const listener = new EventEmitter();

listener.on('orderjob_stop_update', (jobGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderJobService.markAsDeliveredOrPickedUp(jobGuid)]);

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
        const proms = await Promise.allSettled([OrderService.markOrderDelivered(orderGuid, dispatcherGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
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
        const proms = await Promise.allSettled([OrderService.markAsPickedUp(orderGuid, dispatcherGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

module.exports = listener;
