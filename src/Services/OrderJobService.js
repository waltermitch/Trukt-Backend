const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const HttpError = require('../ErrorHandling/Exceptions/HttpError');
const LoadboardService = require('../Services/LoadboardService');
const LoadboardRequest = require('../Models/LoadboardRequest');
const LoadboardPost = require('../Models/LoadboardPost');
const OrderStopLink = require('../Models/OrderStopLink');
const InvoiceLine = require('../Models/InvoiceLine');
const { uuidRegexStr } = require('../Utils/Regexes');
const emitter = require('../EventListeners/index');
const knex = require('../Models/BaseModel').knex();
const Loadboard = require('../Models/Loadboard');
const OrderStop = require('../Models/OrderStop');
const Commodity = require('../Models/Commodity');
const OrderJob = require('../Models/OrderJob');
const Invoice = require('../Models/Invoice');
const Currency = require('currency.js');
const Bill = require('../Models/Bill');
const { DateTime } = require('luxon');
const R = require('ramda');

const Loadboards = require('../Loadboards/API');

const regex = new RegExp(uuidRegexStr);

const SYSUSER = process.env.SYSTEM_USER;

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
        const cleaned = R.pickBy((it) => it !== undefined, payload);

        if (Object.keys(cleaned).length === 0)
            throw new HttpError(400, 'Missing Update Values');

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
                if (deletedStopLinks.length > 0)
                {
                    const stopGuids = [... new Set(deletedStopLinks.map(it => it.stopGuid))];

                    // if the commodity only exists for the order, delete the commodity
                    const deleteLooseOrderStopLinks = [];
                    for (const stopGuid of stopGuids)
                    {
                        deleteLooseOrderStopLinks.push(

                            // delete stopLinks that are not attached to a job, but are attached to the order
                            OrderStopLink.query(trx)
                                .whereIn('commodityGuid', commodities)
                                .where('orderGuid', orderGuid)
                                .where('stopGuid', stopGuid)
                                .whereNull('jobGuid')
                                .whereNotExists(

                                    // and where there are no other stopLinks that are attached to the same stop that are attached to a job
                                    OrderStopLink.query(trx)
                                        .whereIn('commodityGuid', commodities)
                                        .where('stopGuid', stopGuid)
                                        .where('orderGuid', orderGuid)
                                        .whereNotNull('jobGuid'))
                                .delete()
                        );
                    }

                    return Promise.all([
                        // delete the commodities that are not linked to a stopLink that is only attached to an Order
                        Commodity.query(trx)
                            .whereIn('guid', commodities)
                            .whereNotExists(

                                // where a link between another job doesnt exist
                                OrderStopLink.query(trx)
                                    .whereIn('commodityGuid', commodities)
                                    .where('orderGuid', orderGuid)
                                    .whereNotNull('jobGuid'))
                            .delete()
                            .returning('guid'),
                        Promise.all(deleteLooseOrderStopLinks)
                    ]).then((numDeletes) =>
                    {
                        const deletedComms = numDeletes[0].map(it => it.guid);

                        // if the there is a stop that is not attached to an order, delete the stop
                        return OrderStop.query(trx)
                            .whereIn('guid', stopGuids)
                            .whereNotIn('guid', OrderStopLink.query(trx).select('stopGuid'))
                            .delete()
                            .returning('guid')
                            .then((deletedStops) =>
                            {
                                return { deleted: { commodities: deletedComms, stops: deletedStops.map(it => it.guid) }, modified: { stops: stopGuids, commodities: [] } };
                            });
                    });
                }
                else
                {
                    return { deleted: { commodities: [], stops: [] }, modified: { commodities: [], stops: [] } };
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
                const data = jobUpdated.value?.data;
                response[jobGuid] = { error, status, data };
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

    // this is really poorly named, will need to be renamed to something more descriptive
    // TODO - rename this to something more descriptive (post launch)
    static async updateJobStatus(jobGuid, statusToUpdate, userGuid, trx)
    {
        const generalBulkFunctions = {
            'deleted': 'delete',
            'undeleted': 'undelete',
            'canceled': 'cancel',
            'uncanceled': 'uncancel'
        };

        const generalBulkFunctionName = generalBulkFunctions[statusToUpdate];

        if (statusToUpdate == 'ready')
        {
            const [job] = await OrderJob.query(trx).select('dispatcherGuid', 'vendorGuid', 'vendorContactGuid', 'vendorAgentGuid').where('guid', jobGuid);
            if (!job)
                return { jobGuid, error: 'Job Not Found', status: 400 };
            if (!job?.dispatcherGuid)
                return { jobGuid, error: 'Job cannot be marked as Ready without a dispatcher', status: 400 };
            if (job.vendorGuid || job.vendorContactGuid || job.vendorAgentGuid)
                return { jobGuid, error: 'Job cannot transition to Ready with assigned vendor', status: 400 };
        }
        else if (generalBulkFunctionName)
        {
            return await OrderJobService[`${generalBulkFunctionName}Job`](jobGuid, userGuid)
                .then(result =>
                {
                    const status = result.status;
                    const { data } = result?.message;
                    return { jobGuid, error: null, status, data };
                })
                .catch(error =>
                {
                    const status = error?.status || 500;
                    const errorMessage = error?.message || 'Internal server error';
                    return { jobGuid, error: errorMessage, status };
                });
        }
        else
        {
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
    }

    static createStatusPayload(status, userGuid)
    {
        const statusProperties = {
            isOnHold: false,
            isReady: false,
            isCanceled: false,
            isDeleted: false,
            updatedByGuid: userGuid
        };

        switch (status)
        {
            case 'on hold':
                return { ...statusProperties, isOnHold: true, status };
            case 'ready':
                return { ...statusProperties, isReady: true, status };
            case 'canceled':
                return { ...statusProperties, isCanceled: true, status };
            case 'deleted':
                return { ...statusProperties, isDeleted: true, status, deletedByGuid: userGuid };
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
            const data = jobUpdated.value?.data;
            response[jobGuid] = { error, status, data };
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

            const newExpenseValues = await OrderJob.query(trx).select('actualRevenue', 'actualExpense').findById(jobGuid);

            await trx.commit();
            return {
                jobGuid,
                error: null,
                status: 200,
                data: { ...newExpenseValues }
            };
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

    static async getJobCarrier(jobGuid)
    {
        const jobFound = await OrderJob.query().findById(jobGuid);

        if (!jobFound)
            return {
                status: 404,
                data: {
                    status: 404,
                    error: 'Job not found'
                }
            };

        const carrierInfo = await OrderJob.fetchGraph(jobFound)
            .withGraphFetched({ vendor: true, vendorAgent: true, dispatcher: true, dispatches: { vendor: true, vendorAgent: true } })
            .modifyGraph('vendor', builder =>
                builder.select()
                    .leftJoinRelated('rectype')
                    .select('rectype.name as rtype', 'salesforce.accounts.*')
            )
            .modifyGraph('dispatches', (builder) =>
                builder.select().where('isPending', true)
                    .orderBy('dateCreated').limit(1)
            )
            .modifyGraph('dispatches.vendor', builder =>
                builder.select()
                    .leftJoinRelated('rectype')
                    .select('rectype.name as rtype', 'salesforce.accounts.*')
            );

        return {
            status: 200,
            data: {
                vendor: carrierInfo?.vendor || carrierInfo?.dispatches[0]?.vendor || {},
                vendorAgent: carrierInfo?.vendorAgent || carrierInfo?.dispatches[0]?.vendorAgent || {},
                dispatcher: carrierInfo?.dispatcher || {}
            }
        };
    }

    static async setJobToReady(jobGuid, currentUser)
    {
        return await OrderJobService.setJobsToReadyBulk([jobGuid], currentUser);
    }

    static async setJobsToReadyBulk(jobGuids, currentUser)
    {
        const { jobs, exceptions } = await OrderJobService.getJobForReadyCheck(jobGuids);
        const res = { acceptedJobs: [], exceptions: [...exceptions] };

        // for every job that has passed the initial query and given us data
        // loop through every job, and check if it passes more tests.
        // if it does, it returns the valid job guid because that is
        // all we need to update the job to ready.
        for (const job of jobs)
        {
            const readyResult = OrderJobService.checkJobIsReady(job);

            if (typeof readyResult == 'string')
            {
                res.acceptedJobs.push(readyResult);
            }
            else if (readyResult instanceof HttpError)
            {
                res.exceptions.push(readyResult);
            }
        }

        res.acceptedJobs = await OrderJob.query().patch({
            status: OrderJob.STATUS.READY,
            isReady: true,
            dateVerified: DateTime.utc().toString(),
            verifiedByGuid: currentUser,
            updatedByGuid: currentUser
        }).findByIds(res.acceptedJobs).returning('guid', 'orderGuid', 'number', 'status', 'isReady');

        await Promise.allSettled(res.acceptedJobs.map(item =>
            StatusManagerHandler.registerStatus({
                orderGuid: item.orderGuid,
                jobGuid: item.jobGuid,
                userGuid: currentUser,
                statusId: 16
            })));
        return res;
    }

    static async getJobForReadyCheck(jobGuids)
    {
        // this array of question marks is meant to be used for the prepared
        // statement in the following raw query. Because Knex does not support
        // passing in an array of strings as a parameter, you must supply it
        // the raw list with a question mark for every item in the list you
        // are passing in.
        const questionMarks = [];
        for (let i = 0; i < jobGuids.length; i++)
        {
            questionMarks.push('?');
        }

        // This query returns data for jobs with
        // pickups and deliveries in proper sequence, with stops
        // having matching commodities, and stops that at least
        // have a requested start date
        const rows = (await knex.raw(`
            select distinct os.guid "stopGuid", 
                    osl.commodity_guid "commodityGuid", 
                    os.stop_type first_stop_type, 
                    os2.stop_type second_stop_type, 
                    os."sequence" pickup_sequence, 
                    os2."sequence" delivery_sequence, 
                    os.date_requested_start, 
                    os2.date_requested_start,
                    osl.job_guid 
            from rcg_tms.order_stop_links osl
            left join rcg_tms.order_stops os 
            on osl.stop_guid = os.guid ,
            rcg_tms.order_stop_links osl2 
            left join rcg_tms.order_stops os2
            on osl2.stop_guid = os2.guid 
            where os.stop_type = 'pickup'
            and os2.stop_type = 'delivery'
            and osl.commodity_guid = osl2.commodity_guid
            and os."sequence" < os2."sequence"
            and os.date_requested_start is not null
            and os2.date_requested_start is not null
            and osl.order_guid = osl2.order_guid
            and osl.job_guid in (${questionMarks})
            group by os.guid,
                osl.commodity_guid,
                os.stop_type,
                os2.stop_type,
                os."sequence", 
                os2."sequence", 
                os.date_requested_start, 
                os2.date_requested_start,
                osl.job_guid
            order by pickup_sequence`, jobGuids)).rows;

        // Since the previous query only returns some data, we need to know which guids
        // passed the query and which ones did not so we can tell the client which guids
        // did not pass the first test.
        const setGoodGuids = new Set(rows.map(row => row.job_guid));
        const exceptions = [];

        if (jobGuids.length != setGoodGuids.size)
        {
            for (const guid of jobGuids)
            {
                if (!setGoodGuids.has(jobGuids))
                {
                    exceptions.push(new HttpError(409, `${guid} has incorrect stop sequences, is missing requested dates, or cannot be found`));
                }
            }
        }

        const jobs = await OrderJob
            .query()
            .alias('job')
            .select(
                'job.isReady',
                'job.isOnHold',
                'job.isDeleted',
                'job.isCanceled',
                'job.isComplete',
                'job.dispatcherGuid',
                'job.vendorGuid',
                'job.vendorContactGuid',
                'job.vendorAgentGuid',
                'job.orderGuid',
                'job.guid',
                'job.number',
                'order.isTender',
                'vendor.name as vendorName',
                'type.category as typeCategory',
                'type.type as jobType'
            )
            .leftJoinRelated('order')
            .leftJoinRelated('vendor')
            .leftJoinRelated('type')
            .withGraphFetched('[requests(accepted), stops]')
            .findByIds(Array.from(setGoodGuids))
            .modifyGraph('requests', builder =>
            {
                builder.select('isValid', 'isAccepted');
            })
            .modifyGraph('stops', builder =>
            {
                builder.select('sequence', 'stopType', 'dateRequestedStart',
                    'terminal.isResolved as resolvedTerminal', 'terminal.name as terminalName')
                    .leftJoinRelated('terminal').where({ 'terminal.isResolved': false })
                    .distinctOn('terminal.name');
            });

        return { jobs, exceptions };
    }

    /**
     * @description This function takes an orderjob and checks if it's data is sufficient to allow
     * it to transition to the ready state. It can be used to verify both transport and service jobs
     * @param {OrderJob} job
     * @returns If the job passes all the checks, it returns the job itself,
     * otherwise it returns an http exception
     */
    static checkJobIsReady(job)
    {
        const booleanFields = [
            'job.isReady',
            'job.isOnHold',
            'job.isDeleted',
            'job.isCanceled',
            'job.isComplete'
        ];

        let res = job.guid;

        // A job must belong to a real order(not a tender) before moving to ready
        if (job.isTender)
            res = new HttpError(400, `Job ${job.number} belongs to tender, you must accept tender before moving to ready.`);

        // Job cannot be verified again
        if (job.isReady)
            res = new HttpError(409, `Job ${job.number} has already been verified.`);

        // depending on the job type, we throw a specific message if there is a vendor assigned
        if (job.vendorGuid || job.vendorContactGuid || job.vendorAgentGuid)
        {
            if (job.typeCategory == 'transport' && job.jobType == 'transport')
                res = new HttpError(409, `Carrier ${job.vendorName} for ${job.number} must be undispatched before it can transition to ready.`);
            else if (job.typeCategory == 'service')
                res = new HttpError(409, `Vendor ${job.vendorName} for ${job.number} must be unassigned before it can transition to ready.`);
        }

        // The job cannot have any active loadboard requests
        if (job.requests.length != 0)
            res = new HttpError(409, `Please cancel the loadboard request for ${job.number} for it to go to ready.`);

        // A dispatcher must be assigned
        if (!job.dispatcherGuid)
            res = new HttpError(409, `Please assign a dispatcher to job ${job.number} first.`);

        for (const bool of booleanFields)
        {
            const field = bool.substring(4, bool.length);
            if (job[field])
            {
                res = new HttpError(400, `${field} must be false before ${job.number} can be changed to ready.`);
            }
        }

        // the query should have returned any stops with unverified terminals
        // if there are any stops with unresoled terminals, return an exception
        // telling the client which terminal is unresolved.
        if (job.stops.length != 0)
            for (const stop of job.stops)
                res = new HttpError(400, `Address for ${stop.terminalName} for job ${job.number} cannot be mapped to a real location, please verify the address before verifying this job.`);

        return res;
    }

    static async markJobAsComplete(jobGuid, currentUser)
    {
        const job = await OrderJob.query().where(
            {
                'orderJobs.guid': jobGuid
            })
            .withGraphJoined('order')
            .withGraphJoined('stopLinks').first();

        if (!job)
            throw new HttpError(400, 'Job Doesn\'t Match Criteria To Move To Complete State');
        else if (!job.isReady)
            throw new HttpError(400, 'Job Is Not Ready');
        else if (job.isOnHold)
            throw new HttpError(400, 'Job Is On Hold');
        else if (job.isDeleted)
            throw new HttpError(400, 'Job Is Deleted');
        else if (job.isCanceled)
            throw new HttpError(400, 'Job Is Canceled');
        else if (!job.vendorGuid)
            throw new HttpError(400, 'Job Has No Vendor');
        else if (!job.dispatcherGuid)
            throw new HttpError(400, 'Job Has No Dispatcher');
        else if (job.order.isTender)
            throw new HttpError(400, 'Job Is Part Of Tender Order');
        else if (job.isComplete)
            return 200;

        const allCompleted = job.stopLinks.every(stop => stop.isStarted && stop.isCompleted);

        if (!allCompleted)
            throw new HttpError(400, 'All stops must be completed before job can be marked as complete.');

        await OrderJob.query().patch({ 'isComplete': true, 'updatedByGuid': currentUser, 'status': OrderJob.STATUS.COMPLETED }).where('guid', jobGuid);

        emitter.emit('orderjob_completed', jobGuid);
        emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: OrderJob.STATUS.COMPLETED } });

        return 200;
    }

    static async markJobAsUncomplete(jobGuid, currentUser)
    {
        await OrderJob.query()
            .where({ 'guid': jobGuid })
            .patch({ 'isComplete': false, 'updatedByGuid': currentUser, 'status': OrderJob.STATUS.DELIVERED }).first();

        emitter.emit('orderjob_uncompleted', jobGuid);
        emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: OrderJob.STATUS.DELIVERED } });

        return 200;
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
            // Get the job with dispatches and requests
            const job = await OrderJob.query(trx)
                .select('guid', 'number')
                .findById(jobGuid)
                .withGraphFetched('[loadboardPosts(getPosted), dispatches(activeDispatch), requests(validActive)]')
                .modifyGraph('loadboardPosts', builder => builder
                    .select('loadboardPosts.guid', 'loadboard', 'externalGuid')
                    .orWhere({ loadboard: 'SUPERDISPATCH' }))
                .modifyGraph('dispatches', builder => builder.select('orderJobDispatches.guid'))
                .modifyGraph('requests', builder => builder.select('loadboardRequests.guid'));

            if (!job)
                throw new HttpError(404, 'Job not found');

            // job cannot be dispatched before being put on hold
            if (job.dispatches.length >= 1)
                throw new HttpError(400, 'Job must be undispatched before it can be moved to On Hold');

            // extract all the loadboard post guids so that we can cancel the
            // requests for any loadboard posts that exist
            const loadboardPostGuids = job.loadboardPosts.map(post => post.guid);

            await LoadboardRequest.query(trx).patch({
                isValid: false,
                isCanceled: false,
                isDeclined: true,
                isSynced: true,
                status: OrderJob.STATUS.DECLINED,
                declineReason: 'Job set to On Hold',
                updatedByGuid: currentUser
            })
                .whereIn('loadboardPostGuid', loadboardPostGuids);

            // we need to unpost from all loadboards, but we need to set the order in superdispatch
            // to on hold as well, so that is why we need to extract the superdispatch post
            // and use its external guid to set the order on hold later in this function
            const notSuperdispatchPosts = job.loadboardPosts.filter(post => post.loadboard !== 'SUPERDISPATCH');
            const superdispatchPost = (job.loadboardPosts.filter(post => post.loadboard == 'SUPERDISPATCH'))[0];

            // unpost the load from all loadboards
            // unposting from loadboards automatically cancels any requests on the
            // loadboards end so we only have to cancel them on our end
            await LoadboardService.unpostPostings(job.guid, notSuperdispatchPosts, currentUser);

            if (superdispatchPost)
            {
                const { status } = await Loadboards.putSDOrderOnHold(superdispatchPost.externalGuid);
                if (status == 204)
                {
                    await LoadboardPost.query(trx).patch({
                        externalPostGuid: null,
                        isPosted: false,
                        status: 'unposted',
                        updatedByGuid: currentUser
                    }).findById(superdispatchPost.guid);
                }
                else
                {
                    throw new HttpError(400, 'Job could not be set On Hold in Superdispatch');
                }
            }

            const res = await OrderJob.query(trx)
                .patch({ status: OrderJob.STATUS.ON_HOLD, isOnHold: true, isReady: false, updatedByGuid: currentUser })
                .findById(jobGuid).returning('guid', 'number', 'status', 'isOnHold', 'isReady');

            await trx.commit();

            // updated activity for on hold
            await StatusManagerHandler.registerStatus({
                orderGuid: res.orderGuid,
                jobGuid: job.guid,
                userGuid: currentUser,
                statusId: 22
            });

            emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: OrderJob.STATUS.ON_HOLD } });

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
            const queryRes = await OrderJobService.getJobForReadyCheck([jobGuid]);

            if (queryRes.jobs.length < 1)
            {
                throw queryRes.exceptions;
            }
            const job = queryRes.jobs[0];
            let res;

            if (job.isOnHold)
            {
                // removing the hold before checking if the job is not on hold so that it
                // can pass through the check to see if it is ready.
                await OrderJob.query(trx).patch({ isOnHold: false }).findById(jobGuid);
                job.isOnHold = false;

                // not using the setJobToReady function because that function uses its own
                // transaction and this it does not know the hold has been removed for
                // this current job
                const readyResult = OrderJobService.checkJobIsReady(job);
                if (typeof readyResult == 'string')
                {
                    res = await OrderJob.query(trx).patch(OrderJobService.createStatusPayload('ready', currentUser))
                        .findById(jobGuid).returning('guid', 'number', 'status', 'isOnHold', 'isReady');

                    const post = await LoadboardPost.query(trx).select('externalGuid')
                        .findOne({ loadboard: 'SUPERDISPATCH', jobGuid: res.guid });

                    const { status } = await Loadboards.rollbackManualSDStatusChange(post.externalGuid);
                    if (status !== 200)
                    {
                        throw new HttpError(status, 'Could not remove hold from order on Superdispatch');
                    }
                }
                else if (readyResult instanceof HttpError)
                {
                    throw readyResult;
                }
            }
            else
            {
                throw new HttpError(400, 'This Job does not have any holds.');
            }

            await trx.commit();

            await StatusManagerHandler.registerStatus({
                orderGuid: job.orderGuid,
                jobGuid: jobGuid,
                userGuid: currentUser,
                statusId: 16
            });

            return res;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    static async deleteJob(jobGuid, userGuid)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            // getting job and verify if job is dispatched
            const jobStatus = [
                OrderJob.query(trx)
                    .select('orderGuid').findOne('guid', jobGuid),
                OrderJob.query(trx).alias('job')
                    .select('guid').findOne('guid', jobGuid).modify('statusDispatched')
            ];

            const [job, jobIsDispatched] = await Promise.all(jobStatus);

            if (!job)
                throw new HttpError(404, 'Job does not exist');

            if (job && jobIsDispatched)
                throw new HttpError(400, 'Please un-dispatch the Order before deleting');

            const dbLoadboardNames = (await Loadboard.query())?.map(({ name }) => ({ loadboard: name }));

            // updating postings to be deleted
            await LoadboardService.deletePostings(jobGuid, dbLoadboardNames, userGuid);

            // marking job as deleted
            const payload = OrderJobService.createStatusPayload('deleted', userGuid);

            // creating payload for requests to deleted
            const loadboardRequestPayload = LoadboardRequest.createStatusPayload(userGuid).deleted;

            // mark all orderJob and and requrests as deleted
            await Promise.all([
                OrderJob.query(trx).patch(payload).findById(jobGuid),
                LoadboardRequest.query(trx).patch(loadboardRequestPayload).whereIn('loadboardPostGuid',
                    LoadboardPost.query(trx).select('guid').where('jobGuid', jobGuid))
            ]);

            // commiting transactions
            await trx.commit();

            // Register job deleted
            await StatusManagerHandler.registerStatus({
                orderGuid: job.orderGuid,
                jobGuid: jobGuid,
                userGuid: userGuid,
                statusId: 17
            });

            // emitting event to update status manager 17
            emitter.emit('orderjob_deleted', { orderGuid: job.orderGuid, userGuid, jobGuid });

            return { status: 200 };
        }
        catch (error)
        {
            await trx.rollback();
            throw new HttpError(500, error);
        }
    }

    /**
     * Order is mark as ready in rcg_update_order_job_status_trigger in DB
     * @param {uuid} jobGuid
     * @param {uuid} userGuid
     * @returns
     */
    static async undeleteJob(jobGuid, userGuid)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            const job = await OrderJob.query(trx).select('orderGuid', 'isDeleted').findOne('guid', jobGuid);

            if (!job)
                throw new HttpError(404, 'Job does not exist');

            if (!job?.isDeleted)
                return { status: 200 };

            // setting order back to ready status
            const payload = OrderJobService.createStatusPayload('ready', userGuid);

            // udpating orderJob in data base
            await OrderJob.query(trx).patch(payload).findById(jobGuid);

            // commiting transaction
            await trx.commit();

            // Register job undeleted first
            await StatusManagerHandler.registerStatus({
                orderGuid: job.orderGuid,
                jobGuid: jobGuid,
                userGuid: userGuid,
                statusId: 18
            });

            // emit the event to register with status manager Will randomly update ORDER TO DELETED INCORRECT
            emitter.emit('orderjob_undeleted', { orderGuid: job.orderGuid, userGuid, jobGuid });

            return { status: 200 };
        }
        catch (error)
        {
            await trx.rollback();
            throw new HttpError(500, error);
        }
    }

    static async cancelJob(jobGuid, userGuid)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            // validate if you job conditions
            const job = await OrderJobService.checkJobToCancel(jobGuid, trx);

            // getting loadboard names
            const dbLoadboardNames = (await Loadboard.query())?.map(({ name }) => ({ loadboard: name }));

            // deleted all postings attached to the job
            await LoadboardService.deletePostings(jobGuid, dbLoadboardNames, userGuid);

            // setting up canceled payload
            const payload = OrderJobService.createStatusPayload('canceled', userGuid);

            // creating canceled request payload
            const loadboardRequestPayload = LoadboardRequest.createStatusPayload(userGuid).canceled;

            // updating tables
            await Promise.all([
                OrderJob.query(trx).patch(payload).findById(jobGuid),
                LoadboardRequest.query(trx).patch(loadboardRequestPayload).whereIn('loadboardPostGuid',
                    LoadboardPost.query(trx).select('guid').where('jobGuid', jobGuid))
            ]);

            await trx.commit();

            await StatusManagerHandler.registerStatus({
                orderGuid: job.orderGuid,
                jobGuid: jobGuid,
                userGuid: userGuid,
                statusId: 23
            });

            // setting off an event to update status manager
            emitter.emit('orderjob_canceled', { orderGuid: job.orderGuid, userGuid, jobGuid });

            return { status: 200 };
        }
        catch (error)
        {
            await trx.rollback();
            throw new HttpError(500, error);
        }
    }

    static async checkJobToCancel(jobGuid, trx)
    {
        const jobStatus = [
            OrderJob.query(trx)
                .select('orderGuid', 'isDeleted').findOne('guid', jobGuid),
            OrderJob.query(trx).alias('job')
                .select('guid').findOne('guid', jobGuid).modify('statusDispatched')
        ];

        const [job, jobIsDispatched] = await Promise.all(jobStatus);

        if (!job)
            throw new HttpError(404, 'Job does not exist');

        if (job?.isDeleted)
            throw new HttpError(400, 'This Order is deleted and can not be canceled.');

        if (job && jobIsDispatched)
            throw new HttpError(400, 'Please un-dispatch the Order before deleting');

        return job;
    }

    static async uncancelJob(jobGuid, userGuid)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            // getting canceled job with passed guid
            const job = await OrderJob.query(trx).select('orderGuid', 'isCanceled', 'status').findOne('guid', jobGuid);

            if (!job)
                throw new HttpError(400, 'Job does not exist');

            if (!job?.isCanceled)
                return { status: 200, message: { data: { status: job.status } } };

            // createing ready status to undo delete
            const payload = OrderJobService.createStatusPayload('ready', userGuid);

            // update orderJob to Ready state
            const jobUpdated = await OrderJob.query(trx).patchAndFetchById(jobGuid, payload);

            // commiting transaction
            await trx.commit();

            await StatusManagerHandler.registerStatus({
                orderGuid: job.orderGuid,
                jobGuid: jobGuid,
                userGuid: userGuid,
                statusId: 24
            });

            // emitting event for update statys manager
            emitter.emit('orderjob_uncanceled', { orderGuid: job.orderGuid, userGuid, jobGuid });

            return { status: 200, message: { data: { status: jobUpdated.status } } };
        }
        catch (error)
        {
            await trx.rollback();
            throw new HttpError(500, error);
        }
    }

    static recalcJobStatus(jobGuid)
    {
        if (!regex.test(jobGuid))
            throw new HttpError(400, 'Not a Job UUID');

        return knex.raw(`
            SELECT
                oj.status as current_status,
                oj.is_on_hold,
                oj.is_complete,
                oj.is_deleted,
                oj.is_canceled,

                ( SELECT bool_or(links.is_completed) 
                FROM rcg_tms.order_stop_links links
                LEFT JOIN rcg_tms.order_stops stop ON stop.guid = links.stop_guid
                WHERE links.job_guid = oj.guid AND stop.stop_type = 'pickup' ) AS is_pickedup,
                
                ( SELECT bool_and(links.is_completed) FROM rcg_tms.order_stop_links links LEFT JOIN rcg_tms.order_stops stop ON stop.guid = links.stop_guid WHERE links.job_guid = oj.guid AND stop.stop_type = 'delivery' ) AS is_delivered,
                ( SELECT count(*) > 0 FROM rcg_tms.loadboard_posts lbp WHERE lbp.job_guid = oj.guid AND lbp.is_posted) AS is_posted,
                ( SELECT count(*) > 0 FROM rcg_tms.loadboard_requests lbr
                    LEFT JOIN rcg_tms.loadboard_posts lbp2 ON lbp2.guid = lbr.loadboard_post_guid WHERE lbr.is_valid AND lbp2.job_guid = oj.guid) AS has_requests,
                ( SELECT count(*) > 0 FROM rcg_tms.order_job_dispatches ojd WHERE ojd.job_guid = oj.guid AND ojd.is_valid AND ojd.is_pending) AS is_pending,
                ( SELECT count(*) > 0 FROM rcg_tms.order_job_dispatches ojd WHERE ojd.job_guid = oj.guid AND ojd.is_valid AND ojd.is_declined) AS is_declined,
                ( SELECT count(*) > 0 FROM rcg_tms.order_job_dispatches ojd WHERE ojd.job_guid = oj.guid AND ojd.is_valid AND ojd.is_accepted AND oj.vendor_guid IS NOT NULL ) AS is_dispatched,
                oj.is_ready,
                o.is_tender
            FROM
                rcg_tms.order_jobs oj
            LEFT JOIN rcg_tms.orders o
                ON o.guid = oj.order_guid
            WHERE oj.guid = ?
        `, jobGuid).then((response) =>
        {
            const statusArray = response.rows[0];

            if (!statusArray)
                throw new HttpError(400, 'Job does not exist');

            const p = { currentStatus: statusArray.current_status };

            if (statusArray.is_on_hold)
            {
                p.expectedStatus = OrderJob.STATUS.ON_HOLD;
            }
            else if (statusArray.is_complete)
            {
                p.expectedStatus = OrderJob.STATUS.COMPLETED;
            }
            else if (statusArray.is_deleted)
            {
                p.expectedStatus = OrderJob.STATUS.DELETED;
            }
            else if (statusArray.is_canceled)
            {
                p.expectedStatus = OrderJob.STATUS.CANCELED;
            }
            else if (statusArray.is_delivered)
            {
                p.expectedStatus = OrderJob.STATUS.DELIVERED;
            }
            else if (statusArray.is_pickedup)
            {
                p.expectedStatus = OrderJob.STATUS.PICKED_UP;
            }
            else if (statusArray.is_posted || statusArray.has_requests)
            {
                p.expectedStatus = OrderJob.STATUS.POSTED;
            }
            else if (statusArray.is_pending)
            {
                p.expectedStatus = OrderJob.STATUS.PENDING;
            }
            else if (statusArray.is_declined)
            {
                p.expectedStatus = OrderJob.STATUS.DECLINED;
            }
            else if (statusArray.is_dispatched)
            {
                p.expectedStatus = OrderJob.STATUS.DISPATCHED;
            }
            else if (statusArray.is_ready)
            {
                p.expectedStatus = OrderJob.STATUS.READY;
            }
            else if (statusArray.is_tender)
            {
                p.expectedStatus = 'tender';
            }
            else
            {
                p.expectedStatus = OrderJob.STATUS.NEW;
            }

            return p;

        }).catch((error) => console.log(error));
    }

    static async updateStatusField(jobGuid, currentUser = SYSUSER)
    {
        // recalcuate
        const state = await OrderJobService.recalcJobStatus(jobGuid);

        // only do updates when status is different
        if (state.currentStatus === state.expectedStatus)
            return state.currentStatus;
        else
        {
            const job = await OrderJob.query()
                .patch(OrderJob.fromJson({ 'status': state.expectedStatus, 'updatedByGuid': currentUser }))
                .findById(jobGuid)
                .returning('status');

            // emit event
            emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: job.status } });

            return {};
        }
    }

    static async deliverJob(jobGuid, currentUser)
    {
        // get job with the thingies
        const job = await OrderJob.query()
            .select('orderGuid', 'isTransport', 'vendorGuid', 'status')
            .findById(jobGuid)
            .withGraphFetched('commodities.[vehicle]');

        // verify state of data
        if (!job)
            throw new HttpError(404, 'Job does not exist');
        if (job?.isDeleted)
            throw new HttpError(400, 'Job Is Deleted And Can Not Be Mark As Delivered.');
        if (job?.isCanceled)
            throw new HttpError(400, 'Job Is Canceled And Can Not Be Mark As Delivered.');
        if (!job.vendorGuid)
            throw new HttpError(400, 'Job Has No Vendor Assigned');

        for (const commodity of job.commodities)
            if (commodity.deliveryStatus !== OrderJob.STATUS.DELIVERED)
            {
                const { make, model, year } = commodity.vehicle;
                const commodityId = make && model && year ? `${make}-${model}-${year}` : commodity.vehicleId;
                throw new HttpError(400, `Job's Commodity ${commodityId} Has Not Been Delivered`);
            }

        // attempt to update status
        const jobStatus = await OrderJobService.updateStatusField(jobGuid, currentUser);

        // if updated successfully
        if (jobStatus === OrderJob.STATUS.DELIVERED)
        {
            emitter.emit('orderjob_delivered', { jobGuid, dispatcherGuid: currentUser, orderGuid: job.orderGuid });
            return { status: 204 };
        }

        // if we are here, we failed to update status
        throw new HttpError(400, 'Job Could Not Be Mark as Delivered, Please Check All Stops Are Delivered');
    }

    // Sets job as pick up
    static async undeliverJob(jobGuid, currentUser)
    {
        // get job with the thingies
        const job = await OrderJob.query()
            .select('orderGuid', 'status')
            .findById(jobGuid);

        // verify state of data
        if (!job)
            throw new HttpError(404, 'Job does not exist');
        if (job?.isDeleted)
            throw new HttpError(400, 'Job Is Deleted And Can Not Be Mark As Delivered.');
        if (job?.isCanceled)
            throw new HttpError(400, 'Job Is Canceled And Can Not Be Mark As Delivered.');
        if (job.status !== OrderJob.STATUS.DELIVERED && job.status !== OrderJob.STATUS.PICKED_UP)
            throw new HttpError(400, 'Job Must First Be Delivered');

        // attempt to update status
        const jobStatus = await OrderJobService.updateStatusField(jobGuid, currentUser);

        // if updated successfully
        if (jobStatus === OrderJob.STATUS.PICKED_UP)
        {
            emitter.emit('orderjob_picked_up', { jobGuid, dispatcherGuid: currentUser, orderGuid: job.orderGuid });
            return { status: 204 };
        }

        // if we are here, we failed to update status
        throw new HttpError(400, 'Job Could Not Be Mark as Pick Up, Please Check All Stops Are Pick Up');
    }
}

module.exports = OrderJobService;