// get the reference of EventEmitter class of events module
const EventEmitter = require('events');
const OrderService = require('./OrderService');
const OrderStopService = require('./OrderStopService');
const OrderStopLinks = require('../Models/OrderStopLink');

// my class that extencd the Emmitter class
class MyEmitter extends EventEmitter { }

// my instance
const myEmitter = new MyEmitter();

// register event
myEmitter.on('OrderCreate', (orderGuid) =>
{
    // set Immediate make the call async
    setImmediate(() =>
    {
        OrderService.calculatedDistances(orderGuid);
    });
});

// register event
myEmitter.on('OrderUpdate', (Object) =>
{
    // set Immediate make the call async
    setImmediate(() =>
    {
        OrderService.validateStopsBeforeUpdate(Object.old, Object.new);
    });
});

// register event
myEmitter.on('orderstop_status_update', (stopGuids) =>
{
    // this will kill it off on the next loop iteration.
    setImmediate(async () =>
    {
        const trx = await OrderStopLinks.startTransaction();
        await OrderStopService.validateStopLinks(stopGuids, '', trx);
        await trx.commit();
    });
});

// export the event
module.exports = myEmitter;