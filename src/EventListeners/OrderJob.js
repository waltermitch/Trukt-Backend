const ActivityManagerService = require('../Services/ActivityManagerService');
const LoadboardService = require('../Services/LoadboardService');
const OrderJobService = require('../Services/OrderJobService');
const PubSubService = require('../Services/PubSubService');
const OrderService = require('../Services/OrderService');
const SuperDispatch = require('../Loadboards/Super');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const listener = require('./index');
const Super = require('../Loadboards/Super');

// const { raw } = require('objection');

const SYSUSER = process.env.SYSTEM_USER;

listener.on('orderjob_ready', ({ jobGuid, orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 16
            }),
            OrderService.markOrderReady(orderGuid, currentUser)
        ]);

        // This doesn't make any sense so I uncommented it for now
        // Order.query()
        //     .patch({
        //         status: Order.STATUS.VERIFIED,
        //         isReady: true
        //     })
        //     .findById(orderGuid)
        //     .where({ status: Order.STATUS.SUBMITTED, isCanceled: false, isDeleted: false })

        //     // get the count of jobs that are ready for this order guid, if the count is above 0 then update is valid.
        //     .where(raw('(SELECT count(*) FROM rcg_tms.order_jobs jobs WHERE jobs.order_guid = ? AND jobs.is_ready = true) > 0', [orderGuid]))

        // this doesn't exists
        listener.emit('order_verified', orderGuid);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_hold_added', ({ orderGuid, jobGuid, currentUser }) =>
{
    // updated activity for on hold
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 22
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_hold_removed', ({ orderGuid, jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 16
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

/**
 * Sets the job stop status activity
 */
listener.on('orderjob_stop_update', ({ orderGuid, jobGuid, currentUser, jobStop, userAction }) =>
{
    setImmediate(async () =>
    {
        const status = await OrderJobService.updateStatusField(jobGuid, currentUser);
        const [[{ pickupsInProgress }], [{ isStatusForLastDelivery }]] =
            await Promise.all([OrderJobService.getNumberOfPickupsInProgress(jobGuid), OrderJobService.isJobStatusForLastDelivery(jobGuid)]);

        /**
         * Registers the activity log to 'Pickup' only when the first commmodity of the job is pick up
         */
        if (jobStop.stop_type == 'pickup' && pickupsInProgress == 1 && userAction == 'completed')
        {
            await ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 29
            });
        }

        /**
        * Registers the activity log to 'delivered' only when the last commmodity of the job is delivered
        */
        else if (status === OrderJob.STATUS.DELIVERED)
        {
            await ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 27
            });
        }

        /**
        * Registers the activity log to 'dispatched'
        */
        else if (status === OrderJob.STATUS.DISPATCHED)
        {
            await ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 31
            });
        }

        /**
         * Registers the activity log to 'Rollback to pickup' only when the last delivered commodity of the job is back to 'pick up'
         */
        else if (jobStop.stop_type == 'delivery' && userAction == 'started' && isStatusForLastDelivery)
        {
            await ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 32
            });
        }
    });
});

listener.on('orderjob_dispatch_offer_sent', async ({ jobGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, job)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_accepted', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsScheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_canceled', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_dispatch_offer_declined', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

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

// this is for request, temp will change as names get impoved
listener.on('load_request_accepted', ({ jobGuid, currentUser, orderGuid, body }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([LoadboardService.dispatchJob(jobGuid, body, currentUser)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

// this is for load request declined, I don't think much happens to job
listener.on('load_request_declined', ({ jobGuid, currentUser, orderGuid, body }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([]);

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
            ActivityManagerService.createActivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 27
            })
        ]);

        // Log the reason why the order was not set as delivered
        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
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
            ActivityManagerService.createActivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 29
            })
        ]);

        // Log the reason why the order was not set as pick up
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

listener.on('orderjob_deleted', ({ orderGuid, currentUser, jobGuid }) =>
{
    /**
     * Validate if all jobs are deleted on the order, then update activity that order is deleted
     * update activity for job to be deleted
     * and validate status field
     */
    setImmediate(async () =>
    {
        const orderUpdatePromise = [];
        const [jobsOrder] = await OrderJob.query().modify('areAllOrderJobsDeleted', orderGuid);
        if (jobsOrder?.deleteorder)
        {
            const deleteStatusPayload = Order.createStatusPayload(currentUser).deleted;
            orderUpdatePromise.push(
                Order.query().patch(deleteStatusPayload).findById(orderGuid),
                ActivityManagerService.createActivityLog({
                    orderGuid,
                    jobGuid,
                    userGuid: currentUser,
                    activityId: 19
                })
            );
        }

        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 17
            }),
            OrderJobService.updateStatusField(jobGuid, currentUser),
            ...orderUpdatePromise
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_undeleted', ({ orderGuid, currentUser, jobGuid }) =>
{
    /**
     * Register job and order as deleted for activities
     * validate job status field and trigger event if needed
     */
    setImmediate(async () =>
    {
        await Promise.allSettled([
            OrderJobService.updateStatusField(jobGuid, currentUser),
            Super.updateStatus(jobGuid, 'deleted', 'notDeleted'),
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 18
            }),
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 20
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_canceled', ({ orderGuid, currentUser, jobGuid }) =>
{
    /**
    * Register job activity
    * validate job status field
    */
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderJobService.updateStatusField(jobGuid, currentUser),
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 23
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_uncanceled', ({ orderGuid, currentUser, jobGuid }) =>
{
    /**
     * validate and update job status field
     * create loadboard in super dispatch
     * update activity manage with uncanceled job
     */
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderJobService.updateStatusField(jobGuid, currentUser),
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 24
            })
        ]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

listener.on('orderjob_status_updated', ({ jobGuid, currentUser, state }) =>
{
    setImmediate(async () =>
    {
        const currrentJob = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, currrentJob), SuperDispatch.updateStatus(jobGuid, state.oldStatus, state.status)]);

        // for (const p of proms)
        //     if (p.status === 'rejected')
        //         console.log(p.reason?.response?.data || p.reason);
    });
});

module.exports = listener;