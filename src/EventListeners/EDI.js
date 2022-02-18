const emitter = require('./index');
const EDIService = require('../Services/EDIService');
const logEventErrors = require('./logEventErrors');

/**
 * For descriptions of the Events please see the Confluence page "Event System"
 */
emitter.on('order_stop_delivery_started', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'X1');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_delivery_started');
        }
    });
});
emitter.on('order_stop_delivery_unstarted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_delivery_completed', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'D1');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_delivery_completed');
        }
    });
});
emitter.on('order_stop_delivery_uncompleted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_delivery_scheduled', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'AG');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_delivery_scheduled');
        }
    });
});
emitter.on('order_stop_delivery_unscheduled', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_delivery_delayed', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'SD');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_delivery_delayed');
        }
    });
});
emitter.on('order_stop_delivery_early', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'AG');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_delivery_early');
        }
    });
});
emitter.on('order_stop_delivery_scheduled_late', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'SD');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_delivery_scheduled_late');
        }
    });
});
emitter.on('order_stop_delivery_scheduled_early', ({ order, job, stop, datetime }) => { });

emitter.on('order_stop_pickup_started', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'X3');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_pickup_started');
        }
    });
});
emitter.on('order_stop_pickup_unstarted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_completed', ({ order, job, stop, datetime }) =>
{
    setImmediate(async () =>
    {
        try
        {
            EDIService.sendCode({ order, job, stop, datetime }, 'AF');
        }
        catch (error)
        {
            logEventErrors(error, 'order_stop_pickup_completed');
        }
    });
});
emitter.on('order_stop_pickup_uncompleted', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_scheduled', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_unscheduled', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_delayed', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_early', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_scheduled_late', ({ order, job, stop, datetime }) => { });
emitter.on('order_stop_pickup_scheduled_early', ({ order, job, stop, datetime }) => { });