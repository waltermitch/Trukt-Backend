const EventEmitter = require('events');
const OrderService = require('./OrderService');
const OrderStopService = require('./OrderStopService');
const OrderStopLinks = require('../Models/OrderStopLink');

const emitter = new EventEmitter();

emitter.on('order_created', (orderGuid) =>
{
    // set Immediate make the call async
    setImmediate(() =>
    {
        OrderService.calculatedDistances(orderGuid);
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