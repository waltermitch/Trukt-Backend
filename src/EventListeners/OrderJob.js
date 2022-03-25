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
const logEventErrors = require('./logEventErrors');

// const { raw } = require('objection');

const { SYSTEM_USER } = process.env;

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

        logEventErrors(proms, 'orderjob_ready');

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

        logEventErrors(proms, 'orderjob_hold_added');
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

        logEventErrors(proms, 'orderjob_hold_removed');
    });
});

/**
 * Sets the job stop status activity
 */
listener.on('orderjob_stop_update', ({ orderGuid, jobGuid, currentUser, jobStop, userAction }) =>
{
    setImmediate(async () =>
    {
        try
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
        }
        catch (error)
        {
            logEventErrors(error, 'orderjob_stop_update');
        }
    });
});

listener.on('orderjob_dispatch_offer_sent', async ({ jobGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, job)]);

        logEventErrors(proms, 'orderjob_dispatch_offer_sent');
    });
});

listener.on('orderjob_dispatch_offer_accepted', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsScheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        logEventErrors(proms, 'orderjob_dispatch_offer_accepted');
    });
});

listener.on('orderjob_dispatch_offer_canceled', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        logEventErrors(proms, 'orderjob_dispatch_offer_canceled');
    });
});

listener.on('orderjob_dispatch_offer_declined', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        logEventErrors(proms, 'orderjob_dispatch_offer_declined');
    });
});

listener.on('orderjob_dispatch_canceled', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser)]);

        logEventErrors(proms, 'orderjob_dispatch_canceled');
    });
});

listener.on('load_request_accepted', ({ jobGuid }) =>
{
    setImmediate(async () =>
    {
        const [job, resquests, posts] = await Promise.all([OrderJobService.getJobData(jobGuid), LoadboardService.getRequestsbyJobID(jobGuid), LoadboardService.getLoadboardPosts(jobGuid, [])]);

        const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, job), PubSubService.publishJobRequests(jobGuid, resquests), PubSubService.publishJobPostings(jobGuid, posts)]);

        logEventErrors(proms, 'load_request_accepted');
    });
});

// this is for load request declined, I don't think much happens to job
listener.on('load_request_declined', ({ jobGuid, currentUser, orderGuid, body }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([]);

        logEventErrors(proms, 'load_request_declined');
    });
});

listener.on('orderjob_delivered', ({ jobGuid, currentUser = SYSTEM_USER, orderGuid }) =>
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

        logEventErrors(proms, 'orderjob_delivered');
    });
});

listener.on('orderjob_undelivered', ({ jobGuid, currentUser = SYSTEM_USER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markOrderUndelivered(orderGuid, currentUser)]);

        logEventErrors(proms, 'orderjob_undelivered');
    });
});

listener.on('orderjob_picked_up', ({ jobGuid, currentUser = SYSTEM_USER, orderGuid }) =>
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

        logEventErrors(proms, 'orderjob_picked_up');
    });
});

listener.on('orderjob_booked', ({ jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([(OrderJobService.updateStatusField(jobGuid, currentUser))]);

        logEventErrors(proms, 'orderjob_booked');
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
        try
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

            logEventErrors(proms, 'orderjob_deleted');
        }
        catch (error)
        {
            logEventErrors(error, 'orderjob_deleted');
        }
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
        const proms = await Promise.allSettled([
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

        logEventErrors(proms, 'orderjob_undeleted');
    });
});

listener.on('orderjob_canceled', ({ orderGuid, currentUser, jobGuid, state }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createActivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 23
            })
        ]);

        // Notify the client of the status update
        listener.emit('orderjob_status_updated', { jobGuid, currentUser, state });

        logEventErrors(proms, 'orderjob_canceled');
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

        logEventErrors(proms, 'orderjob_uncanceled');
    });
});

listener.on('orderjob_status_updated', ({ jobGuid, currentUser, state }) =>
{
    setImmediate(async () =>
    {
        try
        {
            const currrentJob = await OrderJobService.getJobData(jobGuid);
            const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, currrentJob), SuperDispatch.updateStatus(jobGuid, state.oldStatus, state.status)]);

            logEventErrors(proms, 'orderjob_status_updated');
        }
        catch (error)
        {
            logEventErrors(error, 'orderjob_status_updated');
        }
    });
});

listener.on('orderjob_service_dispatched', ({ jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        try
        {
            const currentJob = await OrderJobService.getJobData(jobGuid);
            const proms = await Promise.allSettled([
                PubSubService.jobUpdated(jobGuid, currentJob),
                ActivityManagerService.createActivityLog({
                    orderGuid: currentJob.orderGuid,
                    jobGuid,
                    userGuid: currentUser,
                    activityId: 34
                })
            ]);

            logEventErrors(proms, 'orderjob_service_dispatched');
        }
        catch (error)
        {
            logEventErrors(error, 'orderjob_service_dispatched');
        }
    });
});

listener.on('orderjob_completed', ({ jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        try
        {
            const currentJob = await OrderJobService.getJobData(jobGuid);

            const proms = await Promise.allSettled([
                PubSubService.jobUpdated(jobGuid, currentJob),
                ActivityManagerService.createActivityLog({
                    orderGuid: currentJob.orderGuid,
                    jobGuid,
                    userGuid: currentUser,
                    activityId: 35
                })
            ]);

            logEventErrors(proms, 'orderjob_completed');
        }
        catch (error)
        {
            logEventErrors(error, 'orderjob_completed');
        }
    });
});

module.exports = listener;
