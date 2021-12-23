const OrderJobService = require('../Services/OrderJobService');
const OrderService = require('../Services/OrderService');
const { EventEmitter } = require('events');

const listener = new EventEmitter();

listener.on('orderjob_stop_update', (jobGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderJobService.calcJobStatus(jobGuid)]);

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