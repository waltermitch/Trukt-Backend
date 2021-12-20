const OrderJobService = require('../Services/OrderJobService');
const Listener = require('events');

const listener = new Listener();

listener.on('orderjob_stop_update', () =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderJobService.calcJobStatus()]);

        for (const p of proms)
            if (p.status === 'rejected')
                console.log(p.reason?.response?.data || p.reason);
    });
});
