const OrderStopLink = require('../Models/OrderStopLink');
const OrderStop = require('../Models/OrderStop');
const Commodity = require('../Models/Commodity');
const OrderJob = require('../Models/OrderJob');
const InvoiceLine = require('../Models/InvoiceLine');
const Invoice = require('../Models/Invoice');
const Bill = require('../Models/Bill');
const { pickBy } = require('ramda');
const Currency = require('currency.js');

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

    /**
     *  Returns a promise that will delete the commodities and all that Jazz from the Job.
     * @param {String} orderGuid
     * @param {String} jobGuid
     * @param {String[]} commodities
     * @param {Transaction} trx
     * @returns
     */
    static deleteCommodities(orderGuid, jobGuid, commodities, trx)
    {
        return OrderStopLink.query(trx)
            .whereIn('commodityGuid', commodities)
            .where('jobGuid', jobGuid)
            .where('orderGuid', orderGuid)
            .delete()
            .returning('stopGuid')
            .then((deletedStopLinks) =>
            {
                const stopGuids = [... new Set(deletedStopLinks.map(it => it.stopGuid))];

                if (deletedStopLinks.length > 0)
                {
                    // if the commodity only exists for the order, delete the commodity
                    const deleteLooseOrderStopLinks = [];
                    for (const stopGuid of stopGuids)
                    {
                        deleteLooseOrderStopLinks.push(
                            OrderStopLink.query(trx)
                                .whereIn('commodityGuid', commodities)
                                .where('orderGuid', orderGuid)
                                .where('stopGuid', stopGuid)
                                .whereNull('jobGuid')
                                .whereNotExists(
                                    OrderStopLink.query(trx)
                                        .whereIn('commodityGuid', commodities)
                                        .where('stopGuid', stopGuid)
                                        .where('orderGuid', orderGuid)
                                        .whereNotNull('jobGuid'))
                                .delete()
                        );
                    }

                    return Promise.all([
                        Commodity.query(trx)
                            .whereIn('guid', commodities)
                            .whereNotExists(
                                OrderStopLink.query(trx)
                                    .whereIn('commodityGuid', commodities)
                                    .where('orderGuid', orderGuid)
                                    .whereNotNull('jobGuid'))
                            .delete(),
                        Promise.all(deleteLooseOrderStopLinks)
                    ]).then((numDeletes) =>
                    {
                        console.log('deleted commodities: ', numDeletes);

                        // if the there is a stop that is not attached to an order, delete the stop
                        return OrderStop.query(trx)
                            .whereIn('guid', stopGuids)
                            .whereNotIn('guid', OrderStopLink.query(trx).select('stopGuid'))
                            .delete();
                    });
                }
            });
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
            const [job] = await OrderJob.query(trx).select('dispatcherGuid', 'vendorGuid', 'vendorContactGuid', 'vendorAgentGuid').where('guid', jobGuid);
            if (!job)
                return { jobGuid, error: 'Job Not Found', status: 400 };
            if (!job?.dispatcherGuid)
                return { jobGuid, error: 'Job cannot be marked as Ready without a dispatcher', status: 400 };
            if(job.vendorGuid || job.vendorContactGuid || job.vendorAgentGuid)
                return { jobGuid, error: 'Job cannot transition to Ready with assigned vendor', status: 400 };
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

    /**
     * Sets a job to On Hold by checking the boolean field isOnHold to true
     * @param {uuid} jobGuid guid of job to set status
     * @param {*} currentUser object or guid of current user
     * @returns the update job or nothing if no job found
     */
    static async addHold(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();
        try
        {
            const res = await OrderJobService.updateJobStatus(jobGuid, 'On Hold', currentUser, trx);
            await trx.commit();
            return res;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    /**
     * Removes the job status from On Hold by setting the isOnHold field to false
     * @param {uuid} jobGuid guid of job to set status
     * @param {*} currentUser object or guid of current user
     * @returns the update job or nothing if no job found
     */
    static async removeHold(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();
        try
        {
            const job = await OrderJob.query(trx).findById(jobGuid);
            let res;
            if (job.isOnHold)
            {
                res = await OrderJobService.updateJobStatus(jobGuid, 'Ready', currentUser, trx);
            }
            else
            {
                res = { status: 400, message: 'This Job does not have any holds.' };
            }

            await trx.commit();
            return res;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }
    
    static async bulkUpdatePrices(jobInput, userGuid)
    {
        const { jobs, expense, revenue, type, operation } = jobInput;
        const JobUpdatePricePromises = jobs.map(jobGuid =>
            OrderJobService.updateJobPrice(jobGuid, expense, revenue, type, operation, userGuid)
        );
        const jobsUpdated = await Promise.allSettled(JobUpdatePricePromises);

        return jobsUpdated.reduce((response, jobUpdated) =>
        {
            const jobGuid = jobUpdated.value?.jobGuid;
            const status = jobUpdated.value?.status;
            const error = jobUpdated.value?.error;
            response[jobGuid] = { error, status };
            return response;
        }, {});
    }

    static async updateJobPrice(jobGuid, expense, revenue, type, operation, userGuid)
    {
        const trx = await OrderStop.startTransaction();
        try
        {
            const updatePricesPromises = [];
            if (expense)
            {
                const jobLinesQuery = InvoiceLine.query(trx).select('guid', 'amount')
                    .where('itemId', 1)
                    .whereNotNull('commodityGuid')
                    .whereIn('invoiceGuid',
                        Bill.query(trx).select('billGuid').where('jobGuid', jobGuid)
                    );
                updatePricesPromises.push(OrderJobService.updatePrices(jobLinesQuery, expense, type, operation, userGuid, trx));
            }

            if (revenue)
            {
                const orderLinesQuery = InvoiceLine.query(trx).select('guid', 'amount')
                    .where('itemId', 1)
                    .whereNotNull('commodityGuid')
                    .whereIn('invoiceGuid',
                        Invoice.query(trx).select('invoiceGuid').where('orderGuid',
                            OrderJob.query(trx).select('orderGuid').where('guid', jobGuid)
                        )
                    );
                updatePricesPromises.push(OrderJobService.updatePrices(orderLinesQuery, revenue, type, operation, userGuid, trx));
            }

            await Promise.all(updatePricesPromises);

            await trx.commit();
            return { jobGuid, error: null, status: 200 };
        }
        catch (error)
        {
            await trx.rollback();
            return { jobGuid, error: error?.message || error, status: error?.status || 400 };
        }
    }

    static async updatePrices(query, expense, type, operation, userGuid, trx)
    {
        const lines = await query;

        if (!lines.length)
            throw { message: 'No transport lines found for job', status: 404 };

        const linesToUpdate = OrderJobService.createLinesToUpdateArray(lines, expense, type, operation, userGuid);
        return InvoiceLine.query(trx).upsertGraph(linesToUpdate, {
            noDelete: true,
            noInsert: true,
            noRelate: true,
            noUnrelate: true
        });
    }

    static createLinesToUpdateArray(linesArray = [], inputAmount, type, operation, userGuid)
    {
        const numberOfLines = linesArray.length;
        return linesArray.map(({ guid, amount: oldLineAmount }, lineIndex) =>
        {
            const newAmount = OrderJobService.calculateNewPriceAmount(oldLineAmount, inputAmount, operation, type, numberOfLines, lineIndex);
            return InvoiceLine.fromJson({
                guid,
                amount: newAmount,
                updatedByGuid: userGuid
            });
        }
        );
    }

    static calculateNewPriceAmount(oldLineAmount, inputAmount, operation = 'set', type = 'flat', numberOfLines, lineIndex)
    {
        let amount;
        if (type === 'percent')
        {
            const percentage = inputAmount / 100;
            amount = Currency(oldLineAmount).multiply(percentage).value;
        }
        else
            amount = (Currency(inputAmount).distribute(numberOfLines))[lineIndex].value;

        switch (operation)
        {
            case 'increase':
                return (Currency(oldLineAmount).add(amount)).value;
            case 'decrease':
                return (Currency(oldLineAmount).subtract(amount)).value;
            default:
                return amount;
        }
    }
}

module.exports = OrderJobService;