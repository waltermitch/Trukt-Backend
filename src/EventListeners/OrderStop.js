const logEventErrors = require('./logEventErrors');
const listener = require('./index');

listener.on('orderstop_status_update', ({ stops, currentUser }) =>
{
    const OrderStopService = require('../Services/OrderStopService');

    // this will kick it off on the next loop iteration.
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderStopService.validateStops(stops, currentUser)]);

        logEventErrors(proms, 'orderstop_status_update');
    });
});
