const eventLogErrors = require('./eventLogErrors');
const listener = require('./index');

listener.on('orderstop_status_update', ({ stops, currentUser }) =>
{
    const OrderStopService = require('../Services/OrderStopService');

    // this will kick it off on the next loop iteration.
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderStopService.validateStops(stops, currentUser)]);

        eventLogErrors(proms, 'orderstop_status_update');
    });
});
