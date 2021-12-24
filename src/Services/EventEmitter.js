const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const LoadboardService = require('../Services/LoadboardService');
const OrderStopLinks = require('../Models/OrderStopLink');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const EventEmitter = require('events');

const emitter = new EventEmitter();

emitter.on('order_created', (orderGuid) =>
{
    const OrderService = require('./OrderService');

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
    const OrderService = require('./OrderService');

    // set Immediate make the call async
    setImmediate(() =>
    {
        OrderService.validateStopsBeforeUpdate(Object.old, Object.new);
    });
});

emitter.on('orderstop_status_update', (stopGuids) =>
{
    const OrderStopService = require('./OrderStopService');

    // this will kick it off on the next loop iteration.
    setImmediate(async () =>
    {
        const trx = await OrderStopLinks.startTransaction();
        await OrderStopService.validateStopLinks(stopGuids, '', trx);
        await trx.commit();
    });
});

emitter.on('orderjob_status', (orderGuid) =>
{
    setImmediate(async () =>
    {
        const trx = await Order.startTransaction();
        try
        {
            // Get the number of jobs that are ready for this order guid.
            // Knex returns this query as an array of objects with a count property.
            const readyJobsCount = (await OrderJob.query(trx).count('guid').where({ orderGuid, isReady: true }))[0].count;

            // WARNING: The COUNT() query in knex with pg returns the count as a string, so
            // the following comparison only works because of javascript magic
            if (readyJobsCount >= 1)
            {
                await Order.query(trx).patch({
                    isReady: true,
                    status: 'ready'
                }).findById(orderGuid);
            }

            await trx.commit();

            emitter.emit('order_status', { orderGuid, status: 'ready' });
        }
        catch (e)
        {
            await trx.rollback();
        }

    });
});

emitter.on('orderjob_deleted', async ({ orderGuid, userGuid, jobGuid }) =>
{
    try
    {
        // Register job deleted first
        await StatusManagerHandler.registerStatus({
            orderGuid,
            jobGuid,
            userGuid,
            statusId: 17
        });

        const [jobsOrder] = await OrderJob.query().modify('areAllOrderJobsDeleted', orderGuid);
        if (jobsOrder?.deleteorder)
        {
            const deleteStatusPayload = Order.createStatusPayload(userGuid).deleted;
            await Promise.allSettled([
                Order.query().patch(deleteStatusPayload).findById(orderGuid),

                // Register order deleted
                StatusManagerHandler.registerStatus({
                    orderGuid,
                    jobGuid,
                    userGuid,
                    statusId: 19
                })
            ]);
        }
    }
    catch (error)
    {
        console.error(`Error: Order ${orderGuid} could not be marked as deleted!!. ${error?.message || error}`);
    }

});

emitter.on('orderjob_undeleted', async ({ orderGuid, userGuid, jobGuid }) =>
{
    try
    {
        // Register job undeleted first
        await StatusManagerHandler.registerStatus({
            orderGuid,
            jobGuid,
            userGuid,
            statusId: 18
        });

        // Register order undeleted
        StatusManagerHandler.registerStatus({
            orderGuid,
            jobGuid,
            userGuid,
            statusId: 20
        });
    }
    catch (error)
    {
        console.error(`Error: Order ${orderGuid} could not be marked as undeleted!!. ${error?.message || error}`);
    }
});

emitter.on('orderjob_canceled', async ({ orderGuid, userGuid, jobGuid }) =>
{
    try
    {
        // Register job canceled first
        await StatusManagerHandler.registerStatus({
            orderGuid,
            jobGuid,
            userGuid,
            statusId: 22
        });

        // The order is marked as canceled in rcg_update_order_job_status_trigger
        const order = await Order.query().select('isCanceled').findById(orderGuid);
        if (order?.isCanceled)
        {
            await StatusManagerHandler.registerStatus({
                orderGuid,
                jobGuid,
                userGuid,
                statusId: 24
            });
        }
    }
    catch (error)
    {
        // TODO: Error handler
    }
});

emitter.on('orderjob_uncanceled', async ({ orderGuid, userGuid, jobGuid }) =>
{
    try
    {
        // Register job uncanceled first
        await StatusManagerHandler.registerStatus({
            orderGuid,
            jobGuid,
            userGuid,
            statusId: 23
        });

        await StatusManagerHandler.registerStatus({
            orderGuid,
            jobGuid,
            userGuid,
            statusId: 25
        });
    }
    catch (error)
    {
        // TODO: Error handler
    }
});

// export the event
module.exports = emitter;