const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const LoadboardService = require('../Services/LoadboardService');
const OrderJobService = require('../Services/OrderJobService');
const PubSubService = require('../Services/PubSubService');
const OrderService = require('../Services/OrderService');
const SuperDispatch = require('../Loadboards/Super');
const StatusLog = require('../Models/StatusLog');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const { raw } = require('objection');
const listener = require('./index');

const SYSUSER = process.env.SYSTEM_USER;

listener.on('orderjob_stop_update', (jobGuid, currentUser) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderJobService.updateStatusField(jobGuid, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_accepted', ({ jobGuid, currentUser, orderGuid, body }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsScheduled(orderGuid, currentUser), LoadboardService.dispatchJob(jobGuid, body, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_canceled', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_declined', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_canceled', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_delivered', ({ jobGuid, currentUser = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderService.markOrderDelivered(orderGuid, currentUser, jobGuid),
            StatusManagerHandler.registerStatus({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                statusId: 27
            })
        ]);

        // Log the reason why the order was not set as delivered
        for (const p of proms)
            if (p.status === 'rejected')
                console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_undelivered', ({ jobGuid, currentUser = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markOrderUndelivered(orderGuid, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_picked_up', ({ jobGuid, currentUser = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderService.markOrderUndelivered(orderGuid, currentUser, jobGuid),
            StatusManagerHandler.registerStatus({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                statusId: 29
            })
        ]);

        // Log the reason why the order was not set as pick up
        for (const p of proms)
            if (p.status === 'rejected')
                console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_status_updated', ({ jobGuid, currentUser, state }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, { currentUser, status: state.status }), SuperDispatch.updateStatus(jobGuid, state.oldStatus, state.status)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_booked', ({ jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([(OrderJobService.updateStatusField(jobGuid, currentUser))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_deleted', async ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
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

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_undeleted', async ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        // Register order undeleted
        await Promise.allSettled([
            StatusManagerHandler.registerStatus({
                orderGuid,
                jobGuid,
                userGuid,
                statusId: 20
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_activity_updated', ({ jobGuid, state }) =>
{
    setImmediate(async () =>
    {
        const currentActivity = await StatusLog.query().select([
            'id',
            'orderGuid',
            'dateCreated',
            'extraAnnotations',
            'jobGuid'
        ])
            .findById(state.id)
            .withGraphFetched({ user: true, status: true })
            .modifyGraph('status', builder => builder.select('id', 'name'))
            .andWhere('jobGuid', jobGuid);

        const proms = await Promise.allSettled([(PubSubService.jobActivityUpdate(jobGuid, currentActivity))]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_canceled', ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            StatusManagerHandler.registerStatus({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: userGuid,
                statusId: 23
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_uncanceled', ({ orderGuid, userGuid, jobGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            LoadboardService.createPostings(jobGuid, [{ loadboard: 'SUPERDISPATCH' }], userGuid),
            StatusManagerHandler.registerStatus({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: userGuid,
                statusId: 24
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_ready', (orderGuid) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
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

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);

        // THERE IS NO LISTENER FOR THIS EVENT in Order.js
        listener.emit('order_verified', orderGuid);
    });
});

listener.on('orderjob_status', (orderGuid) =>
{
    // TODO: wrap this in promise.allsettled
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
    // TODO: wrap in promise.allsettled
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
    // TODO: wrap in promise.allsettled
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

module.exports = listener;
