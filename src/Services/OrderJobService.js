const OrderJob = require('../Models/OrderJob');
const OrderStop = require('../Models/OrderStop');
const OrderStopLink = require('../Models/OrderStopLink');
const { pickBy } = require('ramda');

class OrderJobService
{
    static async bulkUpdateUsers({ jobs = [], dispatcher = undefined })
    {
        const results = {};

        // additional fields can be added here
        const payload =
        {
            dispatcherGuid: dispatcher
        };

        // remove and check for undefineds
        const cleaned = pickBy((it) => it !== undefined, payload);

        if (Object.keys(cleaned).length === 0)
            throw { 'status': 400, 'data': 'Missing Update Values' };

        const promises = await Promise.allSettled(jobs.map(async (job) =>
        {
            // need to throw and catch in order to be able to return the guid for mapping of errors
            const res = await OrderJob.query().findById(job).patch(payload).returning('guid')
                .catch((err) => { throw { 'guid': job, 'data': err }; });

            return { 'guid': job, 'data': res };
        }));

        for (const e of promises)
        {
            if (e.reason)
                results[e.reason.guid] = { 'error': e.reason.data, 'status': 400 };
            else if (e.value?.data == undefined || e.value.data == 0)
                results[e.value.guid] = { 'error': 'Job Not Found', 'status': 404 };
            else
                results[e.value.guid] = { 'status': 200 };
        }

        return results;
    }

    static async bulkUpdateDates({ jobs, ...newDates }, userGuid)
    {
        const JobUpdatePromises = jobs.map(jobGuid => OrderJobService.updateJobDates(jobGuid, newDates, userGuid));
        const jobsUpdated = await Promise.allSettled(JobUpdatePromises);

        return jobsUpdated.reduce((response, jobUpdated) =>
        {
            const jobGuid = jobUpdated.value?.jobGuid;
            const status = jobUpdated.value?.status;
            const error = jobUpdated.value?.error;
            response[jobGuid] = { error, status };
            return response;
        }, {});
    }

    /**
     * Updates the first pickup and/or delivery scheduled dates for a job and returns a single response,
     * where an error is return if any of the stops fails to be updated
     * @param {*} jobGuid
     * @param {*} newDates
     * @param {*} userGuid
     * @returns
     */
    static async updateJobDates(jobGuid, newDates, userGuid)
    {
        const trx = await OrderStop.startTransaction();
        try
        {
            const stopsToUpdate = ['pickup', 'delivery'].map(stopType =>
            {
                const payload = OrderJobService.createUpdateDatesPayload(newDates, stopType, userGuid);
                if (payload)
                    return OrderStop.query(trx).patch(payload).where(
                        'guid', OrderStop.query(trx).select('guid').where('stopType', stopType)
                            .whereIn('guid', OrderStopLink.query(trx).select('stop_guid').where('jobGuid', jobGuid))
                            .orderBy('sequence').limit(1)
                    ).then(patchResult =>
                    {
                        const status = patchResult ? 200 : 404;
                        const error = patchResult ? null : 'Job Not Found';
                        return { jobGuid, error, status };
                    }).catch(error =>
                    {
                        return { jobGuid, error: error?.message || error, status: 400 };
                    });
                return { jobGuid, error: null, status: 200 };
            });

            const stopsUpdated = await Promise.all(stopsToUpdate);
            const response = stopsUpdated?.reduce((uniqueResponse, stopUpdated) =>
            {
                const status = stopUpdated.status;
                const error = stopUpdated.error;
                if (error)
                {
                    uniqueResponse.error = error;
                    uniqueResponse.status = status;
                }
                return uniqueResponse;
            }, { jobGuid, error: null, status: 200 });

            if (response.error)
                await trx.rollback();
            else
                await trx.commit();

            return response;
        }
        catch (error)
        {
            await trx.rollback();
            return { jobGuid, error: error?.message || error, status: 400 };
        }
    }

    static createUpdateDatesPayload({
        pickupDateStart,
        pickupDateEnd,
        deliveryDateStart,
        deliveryDateEnd,
        pickupDateType,
        deliveryDateType
    }, stopType, userGuid)
    {
        if ((pickupDateStart || pickupDateEnd || pickupDateType) && stopType === 'pickup')
            return {
                dateScheduledStart: pickupDateStart,
                dateScheduledEnd: pickupDateEnd,
                dateScheduledType: pickupDateType,
                updatedByGuid: userGuid
            };

        if ((deliveryDateStart || deliveryDateEnd || deliveryDateType) && stopType === 'delivery')
            return {
                dateScheduledStart: deliveryDateStart,
                dateScheduledEnd: deliveryDateEnd,
                dateScheduledType: deliveryDateType,
                updatedByGuid: userGuid
            };

        return;
    }

    static async bulkUpdateStatus({ jobs, status }, userGuid)
    {
        // Transaction is required so rcg_update_order_job_status trigger works correctly
        // Other wise it is possible to see unsicronized behavior when all of the jobs of an order are updated
        const trx = await OrderJob.startTransaction();
        try
        {
            const JobUpdatePromises = jobs.map(jobGuid => OrderJobService.updateJobStatus(jobGuid, status, userGuid, trx));
            const jobsUpdated = await Promise.allSettled(JobUpdatePromises);

            const response = jobsUpdated.reduce((response, jobUpdated) =>
            {
                const jobGuid = jobUpdated.value?.jobGuid;
                const status = jobUpdated.value?.status;
                const error = jobUpdated.value?.error;
                response[jobGuid] = { error, status };
                return response;
            }, {});

            await trx.commit();
            return response;
        }

        // This catch should never be called given that we catch async errors on updateJobStatus
        // It is there just to not have a single trx.commit without his rollback
        catch (error)
        {
            await trx.rollback();
            return jobs.reduce((response, jobGuid) =>
            {
                response[jobGuid] = { error, status: 500 };
                return response;
            }, {});
        }

    }

    static async updateJobStatus(jobGuid, statusToUpdate, userGuid, trx)
    {
        if (statusToUpdate == 'Ready')
        {
            const [job] = await OrderJob.query(trx).select('dispatcherGuid').where('guid', jobGuid);
            if (!job)
                return { jobGuid, error: 'Job Not Found', status: 400 };
            if (!job?.dispatcherGuid)
                return { jobGuid, error: 'Job can not be mark as Ready without a dispatcher', status: 400 };
        }

        const payload = OrderJobService.createStatusPayload(statusToUpdate, userGuid);
        const jobUpdateResponse = await OrderJob.query(trx).patch(payload).findById(jobGuid)
            .then(patchResult =>
            {
                const status = patchResult ? 200 : 404;
                const error = patchResult ? null : 'Job Not Found';
                return { jobGuid, error, status };
            })
            .catch(error =>
            {
                return { jobGuid, error: error?.message, status: 400 };
            });

        return jobUpdateResponse;
    }

    static createStatusPayload(status, userGuid)
    {
        const statusProperties = {
            isOnHold: false, isReady: false, isCanceled: false, isDeleted: false, updatedByGuid: userGuid
        };
        switch (status)
        {
            case 'On Hold':
                return { ...statusProperties, isOnHold: true, status };
            case 'Ready':
                return { ...statusProperties, isReady: true, status };
            case 'Canceled':
                return { ...statusProperties, isCanceled: true, status };
            case 'Deleted':
                return { ...statusProperties, isDeleted: true, status };

        }
    }
}

module.exports = OrderJobService;