// get the reference of EventEmitter class of events module
const EventEmitter = require('events');
const OrderService = require('./OrderService');

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

// export the event
module.exports = myEmitter;