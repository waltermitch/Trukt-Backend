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
const eventLogErrors = require('./logEventErrors');

// const { raw } = require('objection');

const SYSUSER = process.env.SYSTEM_USER;

listener.on('orderjob_ready', ({ jobGuid, orderGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createAvtivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 16
            }),
            OrderService.markOrderReady(orderGuid, currentUser)
        ]);

        eventLogErrors(proms, 'orderjob_ready');

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
            ActivityManagerService.createAvtivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 22
            })
        ]);

        eventLogErrors(proms, 'orderjob_hold_added');
    });
});

listener.on('orderjob_hold_removed', ({ orderGuid, jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            ActivityManagerService.createAvtivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 16
            })
        ]);

        eventLogErrors(proms, 'orderjob_hold_removed');
    });
});

listener.on('orderjob_stop_update', ({ orderGuid, jobGuid, currentUser, jobStop }) =>
{
    setImmediate(async () =>
    {
        const status = await OrderJobService.updateStatusField(jobGuid, currentUser);

        // when multi delivery on push activity on first pick up
        if (status === OrderJob.STATUS.PICKED_UP && jobStop.stop_type !== 'delivery')
        {
            try
            {
                await ActivityManagerService.createAvtivityLog({
                    orderGuid: orderGuid,
                    jobGuid: jobGuid,
                    userGuid: currentUser,
                    activityId: 29
                });
            }
            catch (error)
            {
                eventLogErrors(error, 'orderjob_stop_update');
            }
        }

        // when status for job is delivered then push activity as delivered
        else if (status === OrderJob.STATUS.DELIVERED)
        {
            try
            {
                await ActivityManagerService.createAvtivityLog({
                    orderGuid: orderGuid,
                    jobGuid: jobGuid,
                    userGuid: currentUser,
                    activityId: 27
                });
            }
            catch (error)
            {
                eventLogErrors(error, 'orderjob_stop_update');
            }
        }

        // when pick up date was removed from stop, becomes dispatched
        else if (status === OrderJob.STATUS.DISPATCHED)
        {
            try
            {
                await ActivityManagerService.createAvtivityLog({
                    orderGuid: orderGuid,
                    jobGuid: jobGuid,
                    userGuid: currentUser,
                    activityId: 31
                });
            }
            catch (error)
            {
                eventLogErrors(error, 'orderjob_stop_update');
            }
        }
    });
});

listener.on('orderjob_dispatch_offer_sent', async ({ jobGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([PubSubService.jobUpdated(jobGuid, job)]);

        eventLogErrors(proms, 'orderjob_dispatch_offer_sent');
    });
});

listener.on('orderjob_dispatch_offer_accepted', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsScheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        eventLogErrors(proms, 'orderjob_dispatch_offer_accepted');
    });
});

listener.on('orderjob_dispatch_offer_canceled', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        eventLogErrors(proms, 'orderjob_dispatch_offer_canceled');
    });
});

listener.on('orderjob_dispatch_offer_declined', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const job = await OrderJobService.getJobData(jobGuid);
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser), PubSubService.jobUpdated(jobGuid, job)]);

        eventLogErrors(proms, 'orderjob_dispatch_offer_declined');
    });
});

listener.on('orderjob_dispatch_canceled', ({ jobGuid, currentUser, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markAsUnscheduled(orderGuid, currentUser)]);

        eventLogErrors(proms, 'orderjob_dispatch_canceled');
    });
});

// this is for request, temp will change as names get impoved
listener.on('load_request_accepted', ({ jobGuid, currentUser, orderGuid, body }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([LoadboardService.dispatchJob(jobGuid, body, currentUser)]);

        eventLogErrors(proms, 'load_request_accepted');
    });
});

// this is for load request declined, I don't think much happens to job
listener.on('load_request_declined', ({ jobGuid, currentUser, orderGuid, body }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([]);

        eventLogErrors(proms, 'load_request_declined');
    });
});

listener.on('orderjob_delivered', ({ jobGuid, currentUser = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderService.markOrderDelivered(orderGuid, currentUser, jobGuid),
            ActivityManagerService.createAvtivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 27
            })
        ]);

        eventLogErrors(proms, 'orderjob_delivered');
    });
});

listener.on('orderjob_undelivered', ({ jobGuid, currentUser = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([OrderService.markOrderUndelivered(orderGuid, currentUser)]);

        eventLogErrors(proms, 'orderjob_undelivered');
    });
});

listener.on('orderjob_picked_up', ({ jobGuid, currentUser = SYSUSER, orderGuid }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([
            OrderService.markOrderUndelivered(orderGuid, currentUser, jobGuid),
            ActivityManagerService.createAvtivityLog({
                orderGuid,
                jobGuid,
                userGuid: currentUser,
                activityId: 29
            })
        ]);

        eventLogErrors(proms, 'orderjob_picked_up');
    });
});

listener.on('orderjob_booked', ({ jobGuid, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([(OrderJobService.updateStatusField(jobGuid, currentUser))]);

        eventLogErrors(proms, 'orderjob_booked');
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
                    ActivityManagerService.createAvtivityLog({
                        orderGuid,
                        jobGuid,
                        userGuid: currentUser,
                        activityId: 19
                    })
                );
            }
    
            const proms = await Promise.allSettled([
                ActivityManagerService.createAvtivityLog({
                    orderGuid,
                    jobGuid,
                    userGuid: currentUser,
                    activityId: 17
                }),
                OrderJobService.updateStatusField(jobGuid, currentUser),
                ...orderUpdatePromise
            ]);
    
            eventLogErrors(proms, 'orderjob_deleted');
        }
        catch (error)
        {
            eventLogErrors(error, 'orderjob_deleted');
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
            ActivityManagerService.createAvtivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 18
            }),
            ActivityManagerService.createAvtivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 20
            })
        ]);
        
        eventLogErrors(proms, 'orderjob_undeleted');
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
            ActivityManagerService.createAvtivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 23
            })
        ]);

        eventLogErrors(proms, 'orderjob_canceled');
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
            ActivityManagerService.createAvtivityLog({
                orderGuid: orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                activityId: 24
            })
        ]);

        eventLogErrors(proms, 'orderjob_uncanceled');
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
    
            eventLogErrors(proms, 'orderjob_status_updated');
        }
        catch (error)
        {
            eventLogErrors(error, 'orderjob_status_updated');
        }
    });
});

module.exports = listener;