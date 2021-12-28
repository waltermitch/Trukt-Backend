const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const LoadboardService = require('../Services/LoadboardService');
const OrderStopLinks = require('../Models/OrderStopLink');
const OrderService = require('../Services/OrderService');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const { raw } = require('objection');
const listener = require('./index');

listener.on('order_updated', ({ oldOrder, newOrder }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.validateStopsBeforeUpdate(oldOrder, newOrder), newOrder.jobs.map(async (job) => await LoadboardService.updatePostings(job.guid).catch(err => console.log(err)))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('order_created', (orderGuid) =>
{
    // set Immediate make the call async
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.calculatedDistances(orderGuid), createLoadboardOrder(orderGuid)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('order_client_notes_updated', (orderGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([getJobGuids(orderGuid).then(jobGuids => jobGuids.map(jobGuid => LoadboardService.updatePostings(jobGuid.guid)))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderstop_status_update', (stopGuids) =>
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

listener.on('orderjob_status', (orderGuid) =>
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

            listener.emit('order_status', { orderGuid, status: 'ready' });
        }
        catch (e)
        {
            await trx.rollback();
        }

    });
});

listener.on('orderjob_deleted', async ({ orderGuid, userGuid, jobGuid }) =>
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

listener.on('orderjob_undeleted', async ({ orderGuid, userGuid, jobGuid }) =>
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

async function createLoadboardOrder(orderGuid)
{
    const jobsToPost = await OrderService.getTransportJobsIds(orderGuid);

    await Promise.allSettled(jobsToPost?.map(({ guid, createdByGuid }) =>
        LoadboardService.createPostings(guid, [{ loadboard: 'SUPERDISPATCH' }], createdByGuid)
    ));
}

async function getJobGuids(orderGuid)
{
    const jobs = await OrderJob.query().select('guid').where('orderGuid', orderGuid);

    return jobs;
}

listener.on('orderjob_ready', (orderGuid) =>
{
    setImmediate(async () =>
    {
        await Promise.allSettled([
            Order.query()
                .patch({
                    status: Order.STATUS.VERIFIED,
                    isReady: true
                })
                .findById(orderGuid)
                .where({ status: Order.STATUS.SUBMITTED, isCanceled: false, isDeleted: false })

                // get the count of jobs that are ready for this order guid, if the count is above 0 then update is valid.
                .where(raw('(SELECT count(*) FROM rcg_tms.order_jobs jobs WHERE jobs.order_guid = ? AND jobs.is_ready = true) > 0', [orderGuid]))
        ]);

        listener.emit('order_verified', orderGuid);
    });
});

module.exports = listener;