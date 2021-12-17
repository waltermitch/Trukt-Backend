const EventEmitter = require('events');
const OrderService = require('./OrderService');
const OrderStopService = require('./OrderStopService');
const OrderStopLinks = require('../Models/OrderStopLink');
const LoadboardService = require('../Services/LoadboardService');

const emitter = new EventEmitter();

emitter.on('order_created', (orderGuid) =>
{
    // set Immediate make the call async
    setImmediate(async () =>
    {
        OrderService.calculatedDistances(orderGuid);
        const jobsToPost = await OrderService.getTransportJobsIds(orderGuid);
        await Promise.allSettled(jobsToPost?.map(({ guid, createdByGuid }) =>
            LoadboardService.createPostings(guid, [{ loadboard: 'SUPERDISPATCH' }], createdByGuid)
        ));
    });
});

emitter.on('OrderUpdate', (Object) =>
{
    // set Immediate make the call async
    setImmediate(() =>
    {
        OrderService.validateStopsBeforeUpdate(Object.old, Object.new);
    });
});

emitter.on('orderstop_status_update', (stopGuids) =>
{
    // this will kick it off on the next loop iteration.
    setImmediate(async () =>
    {
        const trx = await OrderStopLinks.startTransaction();
        await OrderStopService.validateStopLinks(stopGuids, '', trx);
        await trx.commit();
    });
});

// export the event
module.exports = emitter;