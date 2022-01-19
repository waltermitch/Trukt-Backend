const emitter = require('./index');
const EDIService = require('../Services/EDIService');

/**
 * For descriptions of the Events please see the Confluence page "Event System"
 */
emitter.on('order_stop_delivery_started', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_delivery_unstarted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_delivery_completed', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () => { EDIService.sendCode({ order, job, stop, datetime }, 'D1'); });
});
emitter.on('order_stop_delivery_uncompleted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_delivery_scheduled', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () => { EDIService.sendCode({ order, job, stop, datetime }, 'AG'); });
});
emitter.on('order_stop_delivery_unscheduled', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_delivery_delayed', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () => { EDIService.sendCode({ order, job, stop, datetime }, 'SD'); });
});
emitter.on('order_stop_delivery_early', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () => { EDIService.sendCode({ order, job, stop, datetime }, 'AG'); });
});
emitter.on('order_stop_delivery_scheduled_late', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () => { EDIService.sendCode({ order, job, stop, datetime }, 'SD'); });
});
emitter.on('order_stop_delivery_scheduled_early', ({ order, job, stop, datetime }) => { });

emitter.on('order_stop_pickup_started', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_unstarted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_completed', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_uncompleted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_scheduled', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_unscheduled', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_delayed', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_early', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_scheduled_late', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_scheduled_early', ({ order, job, stop, datetime }) => { });