const { MissingDataError, NotFoundError, DataConflictError, ValidationError, ApiError, ApplicationError } = require('../ErrorHandling/Exceptions');
const { AppResponse, BulkResponse } = require('../ErrorHandling/Responses');
const LoadboardService = require('../Services/LoadboardService');
const LoadboardRequest = require('../Models/LoadboardRequest');
const OrderJobDispatch = require('../Models/OrderJobDispatch');
const InvoiceLineLink = require('../Models/InvoiceLineLink');
const LoadboardPost = require('../Models/LoadboardPost');
const OrderStopLink = require('../Models/OrderStopLink');
const OrderJobType = require('../Models/OrderJobType');
const InvoiceLine = require('../Models/InvoiceLine');
const { uuidRegexStr } = require('../Utils/Regexes');
const InvoiceBill = require('../Models/InvoiceBill');
const emitter = require('../EventListeners/index');
const knex = require('../Models/BaseModel').knex();
const SFAccount = require('../Models/SFAccount');
const SFContact = require('../Models/SFContact');
const OrderStop = require('../Models/OrderStop');
const Commodity = require('../Models/Commodity');
const Loadboards = require('../Loadboards/API');
const OrderJob = require('../Models/OrderJob');
const Invoice = require('../Models/Invoice');
const Currency = require('currency.js');
const Bill = require('../Models/Bill');
const { DateTime } = require('luxon');
const { raw } = require('objection');
const R = require('ramda');
const InvoiceLines = require('../Models/InvoiceLine');
const InvoiceSystemLine = require('../Models/InvoiceSystemLine');
const BillService = require('./BIllService');
const InvoiceBillRelationType = require('../Models/InvoiceBillRelationType');

const regex = new RegExp(uuidRegexStr);

const SYSUSER = process.env.SYSTEM_USER;

class OrderJobService
{
    static async getJobData(jobGuid)
    {
        // grabing job with all required fields
        const myjob = await OrderJob
            .query()
            .skipUndefined()
            .findById(jobGuid)
            .withGraphFetched('[vendor(byType),vendorAgent,vendorContact,dispatcher,jobType,stopLinks.[commodity.[vehicle,commType],stop.[terminal,primaryContact,alternativeContact]], bills.[lines.[link]]]');

        // terminal cache for storing terminals
        const terminalCache = {};

        // translating stop links into stops then removing from payload
        myjob.stops = OrderStopLink.toStops(myjob.stopLinks);
        delete myjob.stopLinks;

        // append terminals and commodities to stops
        for (const stop of myjob.stops)
        {
            if (!(stop.terminal.guid in terminalCache))
            {
                terminalCache[stop.terminal.guid] = stop.terminal;
            }

            for (const commodity of stop.commodities)
            {
                const { amount, link = [] } = myjob.findInvocieLineByCommodityAndType(commodity.guid, 1);
                commodity.expense = amount || null;
                commodity.revenue = link[0]?.amount || null;
            }
        }

        // get rid of bills
        delete myjob.bills;

        return myjob;
    }

    static async bulkUpdateUsers({ jobs = [], dispatcher = undefined })
    {
        // additional fields can be added here
        const payload =
        {
            dispatcherGuid: dispatcher
        };

        // remove and check for undefineds
        const cleaned = R.pickBy((it) => it !== undefined, payload);

        if (Object.keys(cleaned).length === 0)
            throw new MissingDataError('Missing Update Values');

        const promises = await Promise.allSettled(jobs.map(async (job) =>
        {
            // need to throw and catch in order to be able to return the guid for mapping of errors
            const res = await OrderJob.query().findById(job).patch(payload).returning('guid')
                .catch((err) => { throw { guid: job, data: err }; });

            return { guid: job, data: res };
        }));

        const bulkResponse = new BulkResponse();
        for (const e of promises)
        {
            if (e.reason)
            {
                bulkResponse
                    .addResponse(e.reason.guid, e.reason.data)
                    .getResponse(e.reason.guid).setStatus(400);
            }
            else if (e.value?.data == undefined || e.value.data == 0)
            {
                bulkResponse
                    .addResponse(e.value.guid, new NotFoundError('Job Not Found'))
                    .getResponse(e.value.guid).setStatus(404);
            }
            else
                bulkResponse.addResponse(e.value.guid).getResponse(e.value.guid).setStatus(200);
        }

        return bulkResponse;
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
        // Delete the links first so the trigger rcg_line_links_sum_calculator can be trigger and can get the lines information
        // If it is trigger after lines delition, then it wont be able to get the information because the lines wont be ther
        return InvoiceLineLink.query(trx)
            .whereIn('line1Guid',
                InvoiceLine.query(trx).select('guid').whereIn('commodityGuid', commodities)
            ).orWhereIn('line2Guid',
                InvoiceLine.query(trx).select('guid').whereIn('commodityGuid', commodities)
            ).delete()
            .then(() =>
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
                                // delete related line items if the commodity is not attached to any other job
                                InvoiceLine.query(trx).whereIn('commodityGuid', commodities)
                                    .whereNotExists(

                                        // where a link between another job doesnt exist
                                        OrderStopLink.query(trx)
                                            .whereIn('commodityGuid', commodities)
                                            .where('orderGuid', orderGuid)
                                            .whereNotNull('jobGuid')).delete().returning('guid'),
                                Promise.all(deleteLooseOrderStopLinks),

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
                                    .returning('guid')
                            ]).then((numDeletes) =>
                            {
                                const deletedComms = numDeletes[2].map(it => it.guid);

                                // if there is a stop that is not attached to an order, delete the stop
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
            });
    }

    static async bulkUpdateDates({ jobs, ...newDates }, userGuid)
    {
        const JobUpdatePromises = jobs.map(jobGuid => OrderJobService.updateJobDates(jobGuid, newDates, userGuid));
        const jobsUpdated = await Promise.allSettled(JobUpdatePromises);

        const bulkResponse = new BulkResponse();
        jobsUpdated.forEach((jobUpdated) =>
        {
            const jobGuid = jobUpdated.value?.jobGuid;
            const status = jobUpdated.value?.status;
            const error = jobUpdated.value?.error;

            bulkResponse.addResponse(jobGuid, error).getResponse(jobGuid).setStatus(status);
        });
        return bulkResponse;
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

            const bulkResponse = new BulkResponse();
            jobsUpdated.forEach((jobUpdated) =>
            {
                const { jobGuid, status, error, data } = jobUpdated.value || {};

                bulkResponse.addResponse(jobGuid, error).getResponse(jobGuid).setStatus(status).setData(data);
            });

            await trx.commit();
            return bulkResponse;
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

    // TODO: DEPRICATE SOON
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
            const [job] = await OrderJob.query(trx)
                .select('dispatcherGuid', 'vendorGuid', 'vendorContactGuid', 'vendorAgentGuid')
                .where('guid', jobGuid);

            if (!job)
                return { jobGuid, error: 'Job Not Found', status: 400 };
            if (!job.dispatcherGuid)
                return { jobGuid, error: 'Job cannot be marked as Ready without a dispatcher', status: 400 };
            if (job.vendorGuid || job.vendorContactGuid || job.vendorAgentGuid)
                return { jobGuid, error: 'Job cannot transition to Ready with assigned vendor', status: 400 };
        }
        else if (generalBulkFunctionName)
        {
            return await OrderJobService[`${generalBulkFunctionName}Job`](jobGuid, userGuid)
                .then(result =>
                {
                    const { status, message } = result;

                    return { jobGuid, error: null, status, data: message?.data };
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
            case 'new':
                return statusProperties;
            case 'on hold':
                return { ...statusProperties, isOnHold: true, status };
            case 'ready':
                return { ...statusProperties, isReady: true, status };
            case 'canceled':
                return { ...statusProperties, isCanceled: true };
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

        const bulkResponse = new BulkResponse();
        jobsUpdated.forEach((jobUpdated) =>
        {
            const jobGuid = jobUpdated.value?.jobGuid;
            const status = jobUpdated.value?.status;
            const error = jobUpdated.value?.error;
            const data = jobUpdated.value?.data;

            bulkResponse.addResponse(jobGuid, error).getResponse(jobGuid).setStatus(status).setData(data);
        });

        return bulkResponse;
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
            throw new NotFoundError('No transport lines found for job');

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
            throw new NotFoundError('Job Not Found');

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

    /**
     * This method takes in a single job guid and will use the bulk method to validate job
     * before setting setting status to ready.
     * @param {uuid} jobGuid current job guid
     * @param {uuid} urrentUser uuid of user that is currently making this request
     * @returns {object}
     */
    static async setJobToReady(jobGuid, currentUser)
    {
        const bulkResponse = await OrderJobService.setJobsToReady([jobGuid], currentUser);

        const response = bulkResponse.getResponse(jobGuid);

        if (response.doErrorsExist())
            response.throwErrorsIfExist();

        return response;
    }

    /**
     * This method will take in array of guids send it to get validated and then update
     * the jobs that pass the validation. Since we are not throwing errors, we will
     * be returning all data succesfull and unseccessfull. This method is designed to do bulk.
     * @param {[uuids]} jobGuids array of job guids
     * @param {uuid} currentUser uuid of user that is currently making this request
     * @returns {BulkResponse}
     */
    static async setJobsToReady(jobGuids, currentUser)
    {
        // Validate jobs and get failed exceptions
        const { goodJobs, jobsExceptions } = await OrderJobService.checkJobForReadyState(jobGuids);

        // for storing responses
        const bulkResponse = new BulkResponse();

        /**
         * loop to failed jobs and compose error messages
         * "jobGuid" :{ status: "200", errors: []}
        */
        for (const failedJob of jobsExceptions)
        {
            // for jobs does not exist
            if (failedJob.status === 404)
            {
                bulkResponse
                    .addResponse(failedJob.guid, failedJob.errors)
                    .getResponse(failedJob.guid)
                    .setStatus(404);
            }
            else
            {
                bulkResponse
                    .addResponse(failedJob.guid, failedJob.errors)
                    .getResponse(failedJob.guid)
                    .setStatus(409);
            }
        }

        // update all of the jobs to ready status and emmit events
        if (goodJobs.length > 0)
        {
            const data = await OrderJob.query().patch({
                status: OrderJob.STATUS.READY,
                isReady: true,
                dateVerified: DateTime.utc().toString(),
                verifiedByGuid: currentUser,
                updatedByGuid: currentUser
            }).findByIds(goodJobs).returning('guid', 'orderGuid', 'number', 'status', 'isReady');

            // loop good guids and send event
            for (const job of data)
            {
                bulkResponse.addResponse(job.guid).getResponse(job.guid).setStatus(200);
                emitter.emit('orderjob_status_updated', { jobGuid: job.guid, currentUser, state: { status: OrderJob.STATUS.READY } });
                emitter.emit('orderjob_ready', { jobGuid: job.guid, orderGuid: job.orderGuid, currentUser });
            }
        }

        // returning body payload
        return bulkResponse;
    }

    /**
     * This method will take in an array of Job guids and create queries to validate the jobs
     * state for change. For missing or incorrect guids, exception array will be created to deal with
     * broken guids or bad orders. No Errors will be directly thrown.
     * @param {[uuid]} jobGuids an array of job guids
     * @returns
     */
    static async checkJobForReadyState(jobGuids)
    {
        // initialize all the required variables and query for guids
        const jobsExceptions = [];
        const jobsQueryArray = [];
        const goodGuids = await OrderJob.query().select('guid').findByIds(jobGuids);

        // find the job that do no exist in the returned query
        // I compare both arrays and create an array of bad guids, then attach an error message
        // so the errors can be properly thrown.
        if (jobGuids.length != goodGuids.length)
        {
            const comp = (x, y) => x === y.guid;
            const badGuids = R.differenceWith(comp, jobGuids, goodGuids);
            const jobsDontExists = badGuids.map((guid) =>
            {
                return { guid: guid, status: 404, errors: [`The job with guid ${guid} doesn't exist.`] };
            });
            jobsExceptions.push(...jobsDontExists);
        }

        // if no good guids were passed, return
        if (!goodGuids.length)
            return { goodJobs: [], jobsExceptions };

        // looping through all the good one to minimize amount of requests return [...result[0].rows, ...result[1].rows];
        for (const job of goodGuids)
        {
            jobsQueryArray.push(knex.raw(`
                -- select a transport job along with the values that will use to validate the transition to the new state
                SELECT
                	oj.guid,
                	oj.order_guid,
                	oj.dispatcher_guid,
                	oj.vendor_guid,
                	oj.vendor_agent_guid,
                	oj.vendor_contact_guid,
                	oj.is_on_hold,
                	oj.is_complete,
                	oj.is_deleted,
                	oj.is_canceled,
                	oj.is_ready,
                	oj.status,
                	oj."number",
                    oj.is_transport,
                    oj.type_id,
                    oj.verified_by_guid,
                    oj.date_started,
                    oj.date_completed,
                    oj.date_verified,
                	(SELECT count(*) > 0 FROM rcg_tms.loadboard_requests lbr
                		LEFT JOIN rcg_tms.loadboard_posts lbp2 ON lbp2.guid = lbr.loadboard_post_guid WHERE lbr.is_valid AND lbr.is_accepted AND lbp2.job_guid = oj.guid) AS has_accepted_requests,
                	stop.pickup_request_type,
                	stop.pickup_requested_date,
                	stop.pickup_requested_date_end,
                	stop.delivery_request_type,
                	stop.delivery_requested_date,                	
                	stop.delivery_requested_date_end,
                	stop.pickup_sequence,
                	stop.delivery_sequence,
                	stop.bad_pickup_address,
                	stop.bad_delivery_address,
                    stop.commodity_guid
                FROM rcg_tms.order_jobs oj
                LEFT JOIN 
                	(SELECT DISTINCT
                			os.date_requested_type pickup_request_type,
                			os.date_requested_start  pickup_requested_date,
                			os.date_requested_end  pickup_requested_date_end,
                			os2.date_requested_type delivery_request_type,
                			os2.date_requested_start  delivery_requested_date,
                			os2.date_requested_end  delivery_requested_date_end,
                			osl.job_guid,
                			os."sequence" pickup_sequence,
                			os2."sequence" delivery_sequence,
                            osl.commodity_guid,
                			CASE WHEN t.is_resolved THEN null ELSE CONCAT(t.street1, ' ', t.city, ' ', t.state, ' ',t.zip_code) END AS bad_pickup_address,
                			CASE WHEN t2.is_resolved THEN null ELSE CONCAT(t2.street1, ' ', t2.city, ' ', t2.state, ' ',t2.zip_code) END AS bad_delivery_address
                		FROM rcg_tms.order_stop_links osl
                		LEFT JOIN rcg_tms.order_stops os ON osl.stop_guid = os.guid
                		LEFT JOIN rcg_tms.terminals t ON os.terminal_guid = t.guid,
                		rcg_tms.order_stop_links osl2
                		LEFT JOIN rcg_tms.order_stops os2 ON osl2.stop_guid = os2.guid
                		LEFT JOIN rcg_tms.terminals t2 ON os2.terminal_guid = t2.guid
                		WHERE os.stop_type = 'pickup'
                		AND os2.stop_type = 'delivery'
                		AND os."sequence" < os2."sequence"
                		AND osl.order_guid = osl2.order_guid
                		AND osl.job_guid = '${job.guid}'
                        AND osl2.job_guid = '${job.guid}'
                		ORDER BY os2."sequence" DESC, os."sequence" ASC LIMIT 1) AS stop ON stop.job_guid = oj.guid
                WHERE guid = '${job.guid}' AND oj.is_transport;  
                
                -- select a service job along with the values that will use to validate the transition to the new state
                SELECT
                        oj.guid,
                        oj.order_guid,
                        oj.dispatcher_guid,
                        oj.vendor_guid,
                        oj.vendor_agent_guid,
                        oj.vendor_contact_guid,
                        oj.is_on_hold,
                        oj.is_complete,
                        oj.is_deleted,
                        oj.is_canceled,
                        oj.is_ready,
                        oj.status,
                        oj."number",
                        oj.is_transport,
                        oj.type_id,
                        oj.verified_by_guid,
                        oj.date_started,
                        oj.date_completed,
                        oj.date_verified,
                        (SELECT count(*) > 0 FROM rcg_tms.loadboard_requests lbr
                            LEFT JOIN rcg_tms.loadboard_posts lbp2 ON lbp2.guid = lbr.loadboard_post_guid WHERE lbr.is_valid AND lbr.is_accepted AND lbp2.job_guid = oj.guid) AS has_accepted_requests,
	                    stop."commodityGuid",
	                    stop.not_resolved_address,
	                    stop.stop_type
                    FROM rcg_tms.order_jobs oj
                    LEFT JOIN
                        (SELECT DISTINCT
                                osl.commodity_guid "commodityGuid",
                                osl.job_guid,
                                CASE WHEN t.is_resolved THEN null ELSE CONCAT(t.street1, ' ', t.state, ' ', t.city, ' ',t.zip_code) END AS not_resolved_address,
                                os.stop_type 
                            FROM rcg_tms.order_stop_links osl
                            LEFT JOIN rcg_tms.order_stops os ON osl.stop_guid = os.guid
                            LEFT JOIN rcg_tms.terminals t ON os.terminal_guid = t.guid
                            WHERE osl.job_guid = '${job.guid}') AS stop ON stop.job_guid = oj.guid
                    WHERE guid = '${job.guid}' AND oj.is_transport = false;   
            `).then((result) =>
            {
                return result[0].rows[0] ?? result[1].rows[0];
            }));
        }

        // making query reuests
        const allJobs = await Promise.all(jobsQueryArray);

        // validating the information
        const { goodJobs, badJobs } = OrderJobService.validateOrderState(allJobs);

        // adding to jobexception all bad jobs
        jobsExceptions.push(...badJobs);

        // return all infomation, this comment is for VLAD xD
        return { goodJobs, jobsExceptions };
    }

    /**
     * The method will be taking in an array of job objects that will have all the
     * required data to validate it's transition to ready state. If errors exist we will accumilate
     * them and return them as bad Jobs, otherwise return them as job that are ready to be set as ready.
     * @param {[{jobObjects}]} allJobsData
     * @returns { goodJobs, badJobs }
     */
    static validateOrderState(allJobsData)
    {
        // separte job kinds
        const goodJobs = [];
        const badJobs = [];

        // validate each job and return human redable errors
        for (const job of allJobsData)
        {
            const errors = [];

            // common validations for all job types
            if (!job.dispatcher_guid)
                errors.push('Please assign a dispatcher first.');
            if (job.is_on_hold)
                errors.push('Cannot set to "Ready" because the job is On Hold');
            if (job.is_canceled)
                errors.push('Cannot set to "Ready" because the job is Canceled');
            if (job.is_deleted)
                errors.push('Cannot set to "Ready" because the job is Deleted');
            if (job.is_complete)
                errors.push('Cannot set to "Ready" because the job is Compelete');
            if (job.is_ready && (job.verified_by_guid || job.date_verified))
                errors.push('Order has been verified already.');
            if (job.vendor_guid && job.is_transport === false)
                errors.push('Please un-assign the Vendor first.');

            // validations for transport job type
            if (job.type_id === 1)
            {
                if (job.vendor_guid && job.is_transport === true)
                    errors.push('Please un-dispatch the Carrier first.');
                if (job.has_accepted_requests)
                    errors.push('Please cancel Carrier request.');
                if ((job.bad_pickup_address || job.bad_delivery_address) && job.is_transport === true)
                    errors.push(`Please use a real address instead of ${job.bad_pickup_address || job.bad_delivery_address}`);
                if (job.not_resolved_address && job.is_transport === false)
                    errors.push(`Please use a real address instead of ${job.not_resolved_address}`);
                if (job.pickup_requested_type == 'no later than' || job.delivery_requested_type == 'no later than')
                {
                    if (!job.pickup_requested_date_end)
                        errors.push('Client requested pickup date is required for "No later than"');
                    if (!job.delivery_requested_date_end)
                        errors.push('Client requested delivery date is required for "No Earlier than"');
                }
                if (job.pickup_requested_type == 'no earlier than' || job.delivery_requested_type == 'no earlier than')
                {
                    if (!job.pickup_requested_date)
                        errors.push('Client requested pickup date is required for "No Earlier than"');
                    if (!job.delivery_requested_date)
                        errors.push('Client requested delivery date is required for "No Earlier than"');
                }
                if (job.pickup_requested_type == 'exactly' || job.pickup_requested_type == 'estimated' || job.delivery_requested_type == 'exactly' || job.delivery_requested_type == 'estimated')
                {
                    if (!job.pickup_requested_date && !job.pickup_requested_date_end)
                        errors.push('Client requested pickup date is required for "Estimated"');
                    if (!job.delivery_requested_date && !job.elivery_requested_date_end)
                        errors.push('Client requested delivery date is required for "Estimated"');
                }

                // if (!job.pickup_requested_date || !job.delivery_requested_date)
                //     errors.push('Client requested pickup and delivery dates must be set.');
                if ((job.commodity_guid === null || job.commodity_guid === undefined) && job.is_transport === true)
                    errors.push('There must be at least one commodity to pick up and deliver.');
                if ((job.commodity_guid === null || job.commodity_guid === undefined) && job.is_transport === false)
                    errors.push('There must be at least one commodity to service.');
                if (job.is_transport === false && job.stop_type != null)
                    errors.push('There must be one service stop.');
            }

            // any other service type
            else
            {
                if (job.is_transport)
                    errors.push('Service job must not be a transport job.');
                if (job.date_started)
                    errors.push('Job must not be started.');
                if (job.date_complete)
                    errors.push('Job must not be completed.');
            }

            // distinguishing jobs, for the special ones xD
            if (errors.length > 0)
            {
                job.errors = errors;
                badJobs.push(job);
            }
            else
            {
                goodJobs.push(job.guid);
            }
        }

        // returning all jobs after validation
        return { goodJobs, badJobs };
    }

    // This is use to validate if a job can be mark as ready or it has some data conflict, it returns the job information and/or the specific error it has
    static async getJobForReadyCheck(jobGuids)
    {
        const jobsNotFoundExceptions = new AppResponse();

        // getting all jobs guid and tranport field to help differentiate job types
        const jobsGuidsFound = await OrderJob.query()
            .alias('job')
            .select('job.guid')
            .modify('isServiceJob')
            .findByIds(jobGuids);

        // Separate jobs types to throw differnet exceptions to the user.
        const { serviceJobsFound, transportJobsFound } = jobsGuidsFound.reduce((allJobs, job) =>
        {
            if (job.isServiceJob)
                allJobs.serviceJobsFound.push(job.guid);
            else
                allJobs.transportJobsFound.push(job.guid);
            return allJobs;
        }, { serviceJobsFound: [], transportJobsFound: [] });

        const jobsFound = [...serviceJobsFound, ...transportJobsFound];

        // if there are guids that are not found, create human readable exceptions for each missing guid
        if (jobsFound.length != jobGuids.length)
        {
            for (let i = 0; i < jobGuids.length; i++)
            {
                if (jobsFound.indexOf(jobGuids[i]) == -1)
                    jobsNotFoundExceptions.addError(new NotFoundError('Job does not exist'));
            }
        }

        // If no job was found, do not continue
        if (!jobsFound.length)
            return { jobs: [], exceptions: jobsNotFoundExceptions };

        // Validating transport and service job through their own methods
        const allJobsChecked = await Promise.all([
            OrderJobService
                .checkTransportJobsToMarkAsReady(transportJobsFound),
            OrderJobService
                .checkServiceJobsToMarkAsReady(serviceJobsFound)
        ]);

        const { jobsExceptions, goodJobs } = allJobsChecked?.reduce((allJobs, jobs) =>
        {
            if (jobs.exceptions?.length)
                allJobs.jobsExceptions.addError(...jobs.exceptions);
            allJobs.goodJobs.push(...jobs.goodJobsGuids);

            return allJobs;
        }, { jobsExceptions: new AppResponse(), goodJobs: [] });

        const allJobsExceptions = new AppResponse();
        allJobsExceptions.combineResponse(jobsExceptions);
        allJobsExceptions.combineResponse(jobsNotFoundExceptions);

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
            .findByIds(Array.from(goodJobs))
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

        return { jobs, exceptions: allJobsExceptions };
    }

    // TODO: DEPRICATE SOON
    static async checkTransportJobsToMarkAsReady(transportJobsFoundGUIDs)
    {
        // If no transport job was found, do not continue
        if (!transportJobsFoundGUIDs.length)
            return { exceptions: [], goodJobsGuids: [] };

        const exceptions = [];

        // this array of question marks is meant to be used for the prepared
        // statement in the following raw query. Because Knex does not support
        // passing in an array of strings as a parameter, you must supply it
        // the raw list with a question mark for every item in the list you
        // are passing in.
        const questionMarks = [];
        for (let i = 0; i < transportJobsFoundGUIDs.length; i++)
            questionMarks.push('?');

        // This query returns data for jobs with
        // pickups and deliveries in proper sequence, with stops
        // having matching commodities, and stops that at least
        // have a requested start date
        const rows = (await knex.raw(`
          SELECT DISTINCT os.guid "stopGuid",
                    osl.commodity_guid "commodityGuid",
                    os.stop_type first_stop_type,
                    os2.stop_type second_stop_type,
                    os."sequence" pickup_sequence,
                    os2."sequence" delivery_sequence,
                    os.date_requested_start pickup_start_date,
                    os.date_requested_end pickup_end_date,
                    os2.date_requested_start delivery_start_date,
                    os2.date_requested_end delivery_end_date,                    
                    osl.job_guid 
            FROM rcg_tms.order_stop_links osl
            LEFT JOIn rcg_tms.order_stops os ON osl.stop_guid = os.guid ,
            rcg_tms.order_stop_links osl2 
            LEFT JOIN rcg_tms.order_stops os2 ON osl2.stop_guid = os2.guid 
            WHERE os.stop_type = 'pickup'
            AND os2.stop_type = 'delivery'
            AND osl.commodity_guid = osl2.commodity_guid
            AND os."sequence" < os2."sequence"
            AND osl.order_guid = osl2.order_guid
            AND osl.job_guid IN (${questionMarks})
            group by os.guid,
                osl.commodity_guid,
                os.stop_type,
                os2.stop_type,
                os."sequence",
                os2."sequence",
                os.date_requested_start,
                os.date_requested_end,
                os2.date_requested_start,
                os2.date_requested_end,
                osl.job_guid
            order by pickup_sequence;`, transportJobsFoundGUIDs)).rows;

        // if all dates are null, then the job is not ready
        const missingDates = (await knex.raw(`
            SELECT DISTINCT(oj."number"), 
                oj.guid "jobGuid", 
                os.stop_type, 
                os.date_requested_start, 
                os.date_requested_end 
            FROM rcg_tms.order_stop_links osl 
            LEFT JOIN rcg_tms.order_stops os ON osl.stop_guid = os.guid 
            LEFT JOIN rcg_tms.order_jobs oj ON osl.job_guid = oj.guid 
            WHERE os.date_requested_start IS NULL
            AND os.date_requested_end IS NULL 
            AND oj.guid in (${questionMarks});
        `, transportJobsFoundGUIDs)).rows;

        // THIS TECHNICALLY NEVER RAN BECAUSE QUERY ABOVE WAS WRONG
        for (const missingDate of missingDates)
        {
            const index = transportJobsFoundGUIDs.indexOf(missingDate.jobGuid);
            if (index > -1)
            {
                exceptions.push(new MissingDataError(`${R.toUpper(missingDate.stop_type)} for job ${missingDate.number} is missing requested dates`));
                transportJobsFoundGUIDs.splice(index, 1);
            }
        }

        // Since the previous query only returns some data, we need to know which guids
        // passed the query and which ones did not so we can tell the client which guids
        // did not pass the first test.
        // UPDATE THIS TO DEAL WITH NEW QUERY LOGIC! SCRAY STUFF
        const goodJobsGuids = new Set(rows.map(row =>
        {
            if ((row.pickup_start_date == null && row.pickup_end_date == null) || (row.delivery_start_date == null && row.delivery_end_date == null))
            {
                return;
            }
            return row.job_guid;
        }));

        if (transportJobsFoundGUIDs.length != goodJobsGuids.size)
        {
            for (const guid of transportJobsFoundGUIDs)
            {
                if (!goodJobsGuids.has(guid))
                    exceptions.push(new DataConflictError('Job has incorrect stop sequences, please ensure each commodity has a pickup and delivery. Who ever wrote this error is... a moron.'));
            }
        }

        return { exceptions, goodJobsGuids };
    }

    // This is use to validate if a service job can be mark as ready
    static async checkServiceJobsToMarkAsReady(serviceJobsFound)
    {
        // Check jobs that have at leats one stop, with 1 commodity asigned and dateRequested is not null
        const jobsChecked = await OrderStopLink.query().distinct('jobGuid', 'job.dispatcherGuid', 'job.status', raw('job."canBeMarkAsReady"'))
            .joinRelated('stop')
            .innerJoin(
                OrderJob.query().select('guid', 'dispatcherGuid', 'status')
                    .modify('canServiceJobMarkAsReady')
                    .groupBy('guid').as('job'),
                'jobGuid', 'job.guid'
            )
            .whereIn('jobGuid', serviceJobsFound)
            .whereNotNull('dateRequestedStart');

        return serviceJobsFound?.reduce((allJobs, jobGuid) =>
        {
            const jobToValidate = R.find(R.propEq('jobGuid', jobGuid))(jobsChecked);

            // If jobfound is not in jobsChecked array, it is because it does not have at leaast 1 stop with 1 commodity with date requested start
            if (!jobToValidate)
            {
                allJobs.exceptions.push(new DataConflictError(`Job ${jobGuid} has incorrect stop, please ensure it has at least stop with one commodity and requested date start`));
                return allJobs;
            }

            // Check for job conditions to be mark as ready
            if (!jobToValidate?.dispatcherGuid)
                allJobs.exceptions.push(new MissingDataError(`Job ${jobGuid} does not have a dispatcher`));
            else if (!jobToValidate.canBeMarkAsReady)
                allJobs.exceptions.push(new DataConflictError(`Cannot remove hold from job because it is '${jobToValidate.status}'`));
            else
                allJobs.goodJobsGuids.push(jobGuid);

            return allJobs;
        }, { goodJobsGuids: [], exceptions: [] });
    }

    // TODO: DEPRICATE SOON
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
            res = new DataConflictError(`Job ${job.number} belongs to tender, you must accept tender before moving to ready.`);

        // Job cannot be verified again
        if (job.isReady)
            res = new DataConflictError(`Job ${job.number} has already been verified.`);

        // depending on the job type, we throw a specific message if there is a vendor assigned
        if (job.vendorGuid || job.vendorContactGuid || job.vendorAgentGuid)
        {
            if (job.typeCategory == 'transport' && job.jobType == 'transport')
                res = new DataConflictError(`Carrier ${job.vendorName}  must be undispatched from job ${job.number} before it can transition to ready.`);
            else if (job.typeCategory == 'service')
                res = new DataConflictError(`Vendor ${job.vendorName} must be unassigned from job ${job.number} before it can transition to ready.`);
        }

        // The job cannot have any active loadboard requests
        if (job.requests.length != 0)
            res = new DataConflictError(`Please cancel the loadboard request for ${job.number} for it to go to ready.`);

        // A dispatcher must be assigned
        if (!job.dispatcherGuid)
            res = new MissingDataError(`Please assign a dispatcher to job ${job.number} first.`);

        for (const bool of booleanFields)
        {
            const field = bool.substring(4, bool.length);
            if (job[field])
            {
                res = new DataConflictError(`${field} must be false before ${job.number} can be changed to ready.`);
            }
        }

        // the query should have returned any stops with unverified terminals
        // if there are any stops with unresoled terminals, return an exception
        // telling the client which terminal is unresolved.
        if (job.stops.length != 0)
            for (const stop of job.stops)
                res = new ValidationError(`Address for ${stop.terminalName} for job ${job.number} cannot be mapped to a real location, please verify the address before verifying this job.`);

        return res;
    }

    static async markJobAsComplete(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();
        try
        {
            const job = await OrderJob.query().findById(jobGuid)
                .withGraphJoined('[order,stopLinks]');

            const appResponse = new AppResponse();

            appResponse.addError(...OrderJob.validateJobForCompletion(job));
            appResponse.throwErrorsIfExist();

            if (job.typeId === 1)
            {
                const allCompleted = job.stopLinks.every(stop => stop.isStarted && stop.isCompleted);

                if (!allCompleted)
                    throw new DataConflictError('All stops must be completed before job can be marked as complete.');

                await OrderJob.query(trx).patch({ 'isComplete': true, 'updatedByGuid': currentUser, 'status': OrderJob.STATUS.COMPLETED }).where('guid', jobGuid);

                emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: OrderJob.STATUS.COMPLETED } });
            }
            else
            {
                await job.$query(trx).patch({
                    isComplete: true,
                    updatedByGuid: currentUser,
                    status: OrderJob.STATUS.COMPLETED,
                    dateCompleted: DateTime.now().toISO()
                });
            }

            emitter.emit('orderjob_completed', { jobGuid, currentUser });
            await trx.commit();

            return 200;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async markJobAsUncomplete(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            const job = await OrderJob.query(trx).findById(jobGuid);
            const appResponse = new AppResponse(OrderJob.validateJobForUncomplete(job));
            appResponse.throwErrorsIfExist();
            const isTransport = job.typeId === OrderJobType.TYPES.TRANSPORT;

            await Promise.all([
                job.$query(trx)
                    .patch({
                        dateCompleted: null,
                        isComplete: false,
                        updatedByGuid: currentUser
                    }),
                job.$relatedQuery('stopLinks', trx).patch({
                    isCompleted: false,
                    dateCompleted: null
                }),
                job.$relatedQuery('stops', trx).patch({
                    status: isTransport ? OrderStop.STATUSES.PICKED_UP : OrderStop.STATUSES.IN_PROGRESS,
                    isCompleted: false,
                    dateCompleted: null
                })
                    .orderBy('sequence', 'desc')
                    .limit(1)
            ]);

            // to recalculate the job's status, we need all the order job changes to be applied
            // after that job instance is refreshed to get the latest status
            job.$set(await job.updateStatus(jobGuid, trx));

            await trx.commit();

            emitter.emit('orderjob_uncompleted', job.guid);
            emitter.emit('orderjob_status_updated', {
                jobGuid: job.guid,
                currentUser,
                state: { status: job.status }
            });

            return 200;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    // TODO: Rewrite to make it work with new  ready check
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
            const job = await OrderJobService.checkJobToAddHold(jobGuid, trx);

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
                    throw new ApiError('Job could not be set On Hold in Superdispatch');
                }
            }

            // update status to hold and return fields
            const res = await OrderJob.query(trx)
                .patch({ status: OrderJob.STATUS.ON_HOLD, isOnHold: true, isReady: false, updatedByGuid: currentUser })
                .findById(jobGuid).returning('guid', 'number', 'status', 'isOnHold', 'isReady', 'orderGuid');

            await trx.commit();

            // emit event to update status field and activity
            emitter.emit('orderjob_hold_added', { orderGuid: res.orderGuid, jobGuid, currentUser });
            emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: OrderJob.STATUS.ON_HOLD } });

            return res;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    // TODO: Rewrite to not use the old ready check
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
            // const job = await OrderJob.query(trx).patch({ isOnHold: false }).findById(jobGuid).returning('*');
            // console.log('job', job);

            // // rewite this function checkJobForReadyState
            // const { goodJobs, jobsExceptions } = await OrderJobService.checkJobForReadyState([job.guid]);
            // console.log('Ready State', goodJobs, jobsExceptions);

            const queryRes = await OrderJobService.getJobForReadyCheck([jobGuid]);

            if (queryRes.jobs.length < 1 && queryRes.exceptions?.doErrorsExist())
            {
                queryRes.exceptions.throwErrorsIfExist();
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
                        .findById(jobGuid).returning('guid', 'number', 'status', 'isOnHold', 'isReady', 'orderGuid');

                    const post = await LoadboardPost.query(trx).select('externalGuid')
                        .findOne({ loadboard: 'SUPERDISPATCH', jobGuid: res.guid });

                    if (post?.externalGuid)
                    {
                        const { status } = await Loadboards.rollbackManualSDStatusChange(post.externalGuid);
                        if (status !== 200)
                        {
                            throw new ApiError('Could not remove hold from order on Superdispatch', { status });
                        }
                    }

                }
                else if (readyResult instanceof ApplicationError)
                {
                    throw readyResult;
                }
            }
            else
            {
                throw new NotFoundError('This Job does not have any holds.');
            }

            await trx.commit();

            // emmit event to update activity and status field
            emitter.emit('orderjob_hold_removed', { orderGuid: res.orderGuid, jobGuid, currentUser });
            emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: OrderJob.STATUS.READY } });

            return res;
        }
        catch (e)
        {
            await trx.rollback();
            throw e;
        }
    }

    static async deleteJob(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            const job = await OrderJobService.checkJobToDelete(jobGuid, trx);

            // updating postings to be deleted
            await LoadboardService.deletePostings(jobGuid, currentUser);

            // marking job as deleted
            const payload = OrderJobService.createStatusPayload('deleted', currentUser);

            // creating payload for requests to deleted
            const loadboardRequestPayload = LoadboardRequest.createStatusPayload(currentUser).deleted;

            // mark all orderJob and and requrests as deleted
            await Promise.all([
                OrderJob.query(trx).patch(payload).findById(jobGuid),
                LoadboardRequest.query(trx).patch(loadboardRequestPayload).whereIn('loadboardPostGuid',
                    LoadboardPost.query(trx).select('guid').where('jobGuid', jobGuid))
            ]);

            // commiting transactions
            await trx.commit();

            // emitting event to update status manager 17
            emitter.emit('orderjob_deleted', { orderGuid: job.orderGuid, currentUser, jobGuid });

            return { status: 200 };
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    /**
     * Order is mark as ready in rcg_update_order_job_status_trigger in DB
     * @param {uuid} jobGuid
     * @param {uuid} userGuid
     * @returns
     */
    static async undeleteJob(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            const job = await OrderJob.query(trx).findById(jobGuid);

            const appResponse = new AppResponse(OrderJob.validateJobForUndelete(job));
            appResponse.throwErrorsIfExist();

            // updating orderJob in data base
            await job.$query(trx).patch({
                isDeleted: false,
                updatedByGuid: currentUser
            });

            // this is required to orderjob_status_updated event to be emitted
            const jobStatus = { oldStatus: job.status };

            // Recalculating the status of the job
            job.$set(await job.updateStatus(jobGuid, trx));

            // commiting transaction
            await trx.commit();

            // adding just calculated status in jobStatus
            jobStatus.status = job.status;

            // emit the event to register with status manager Will randomly update ORDER TO DELETED INCORRECT
            emitter.emit('orderjob_undeleted', {
                orderGuid: job.orderGuid,
                currentUser,
                jobGuid,
                jobType: job.typeId,
                status: jobStatus
            });

            return { status: 200 };
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async cancelJob(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            // validate if you job conditions
            const job = await OrderJobService.checkJobToCancel(jobGuid, trx);
            const state = { status: OrderJob.STATUS.CANCELED, oldStatus: job.status };

            // deleted all postings attached to the job
            await LoadboardService.deletePostings(jobGuid, currentUser);

            // setting up canceled payload
            const payload = OrderJobService.createStatusPayload('canceled', currentUser);
            payload.status = OrderJob.STATUS.CANCELED;

            // creating canceled request payload
            const loadboardRequestPayload = LoadboardRequest.createStatusPayload(currentUser).canceled;

            // updating tables
            await Promise.all([
                OrderJob.query(trx).patch(payload).findById(jobGuid),
                LoadboardRequest.query(trx).patch(loadboardRequestPayload).whereIn('loadboardPostGuid',
                    LoadboardPost.query(trx).select('guid').where('jobGuid', jobGuid))
            ]);

            await trx.commit();

            // setting off an event to update status manager, this event will send the updated job info to the client
            emitter.emit('orderjob_canceled', { orderGuid: job.orderGuid, currentUser, jobGuid, state });

            return { status: 200 };
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async checkJobToCancel(jobGuid, trx)
    {
        const jobStatus = [
            OrderJob.query(trx).alias('job')
                .select('job.orderGuid', 'job.isDeleted', 'job.status', 'job.vendorGuid')
                .findOne('job.guid', jobGuid)
                .modify('isServiceJob').modify('vendorName'),

            OrderJob.query(trx).alias('job')
                .select('guid')
                .findOne('guid', jobGuid)
                .modify('statusDispatched'),

            OrderJob.query(trx)
                .findOne('guid', jobGuid)
                .modify('canServiceJobMarkAsCanceled')
        ];

        const [job, jobIsDispatched, canServiceJobMarkAsCanceled] = await Promise.all(jobStatus);

        if (!job)
            throw new NotFoundError('Job does not exist');

        job.jobIsDispatched = jobIsDispatched;
        job.canServiceJobMarkAsCanceled = canServiceJobMarkAsCanceled?.canbemarkascanceled;
        job.validateJobForCanceling();

        return job;
    }

    // TODO: Update cancel
    static async uncancelJob(jobGuid, currentUser)
    {
        const trx = await OrderJob.startTransaction();

        try
        {
            const job = await OrderJob.query(trx).select('orderGuid', 'isCanceled', 'status').findOne('guid', jobGuid);
            const appResponse = new AppResponse(OrderJob.validateJobToUncancel(job));

            appResponse.throwErrorsIfExist();

            if (!job.isCanceled)
                return { status: 200, message: { data: { status: job.status } } };

            // setting job to 'new' status so it can pass the conditions to
            // transition to ready
            const payload = OrderJobService.createStatusPayload('new', currentUser);
            const jobUpdated = await OrderJob.query(trx).patchAndFetchById(jobGuid, payload);

            await trx.commit();

            const { goodJobs, jobsExceptions } = await OrderJobService.checkJobForReadyState([jobUpdated.guid]);
            let data;
            if (goodJobs.length === 1)
            {
                data = await OrderJob.transaction(async (jobTrx) =>
                    await OrderJob.query(jobTrx).patch({
                        isReady: true,
                        dateVerified: DateTime.utc().toString(),
                        verifiedByGuid: currentUser,
                        updatedByGuid: currentUser
                    }).findById(goodJobs).returning('guid', 'orderGuid', 'number', 'status', 'isReady')
                );
            }
            else
            {
                throw new DataConflictError(jobsExceptions[0].errors[0]);
            }

            // the status manager will handle actually changing the jobs status field
            // and sending the updated job to the client
            emitter.emit('orderjob_uncanceled', { orderGuid: job.orderGuid, currentUser, jobGuid });

            return { status: 200, message: { data: { status: data.status } } };
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static recalcJobStatus(jobGuid)
    {
        if (!regex.test(jobGuid))
            throw new ValidationError('Not a Job UUID');

        return knex.raw(`
            SELECT
                oj.status AS "currentStatus",
                oj.is_on_hold AS "isOnHold",
                oj.is_complete AS "isComplete",
                oj.is_deleted AS "isDeleted",
                oj.is_canceled AS "isCanceled",
                oj.type_id AS "typeId",

                ( SELECT bool_or(links.is_completed) 
                FROM rcg_tms.order_stop_links links
                LEFT JOIN rcg_tms.order_stops stop ON stop.guid = links.stop_guid
                WHERE links.job_guid = oj.guid AND stop.stop_type = '${OrderStop.TYPES.PICKUP}' ) AS "isPickedUp",
                
                ( SELECT bool_and(links.is_completed) FROM rcg_tms.order_stop_links links LEFT JOIN rcg_tms.order_stops stop ON stop.guid = links.stop_guid WHERE links.job_guid = oj.guid AND stop.stop_type = '${OrderStop.TYPES.DELIVERY}' ) AS "isDelivered",

                ( SELECT count(*) > 0 FROM rcg_tms.loadboard_posts lbp WHERE lbp.job_guid = oj.guid AND lbp.is_posted) AS "isPosted",

                ( SELECT count(*) > 0 FROM rcg_tms.loadboard_requests lbr
                    LEFT JOIN rcg_tms.loadboard_posts lbp2 ON lbp2.guid = lbr.loadboard_post_guid WHERE lbr.is_valid AND lbp2.job_guid = oj.guid) AS "hasRequests",

                ( SELECT count(*) > 0 FROM rcg_tms.order_job_dispatches ojd WHERE ojd.job_guid = oj.guid AND ojd.is_valid AND ojd.is_pending) AS "isPending",

                ( SELECT count(*) > 0 FROM rcg_tms.order_job_dispatches ojd WHERE ojd.job_guid = oj.guid AND ojd.is_valid AND ojd.is_declined) AS "isDeclined",

                ( SELECT count(*) > 0 FROM rcg_tms.order_job_dispatches ojd WHERE ojd.job_guid = oj.guid AND ojd.is_valid AND ojd.is_accepted AND oj.vendor_guid IS NOT NULL ) AS "isDispatched",

                (SELECT bool_and(links.is_completed) 
                    FROM rcg_tms.order_stop_links links
                    LEFT JOIN rcg_tms.order_stops stop ON stop.guid = links.stop_guid
                    WHERE links.job_guid = oj.guid
                        AND (stop.stop_type = '${OrderStop.TYPES.PICKUP}' OR stop.stop_type = '${OrderStop.TYPES.DELIVERY}' OR stop.stop_type IS NULL))
                AS "isServiceJobCompleted",

                oj.is_ready AS "isReady",
                o.is_tender AS "isTender"
            FROM
                rcg_tms.order_jobs oj
            LEFT JOIN rcg_tms.orders o
                ON o.guid = oj.order_guid
            WHERE oj.guid = ?
        `, jobGuid).then((response) =>
        {
            const statusArray = response.rows[0];

            if (!statusArray)
                throw new NotFoundError('Job does not exist');

            const p = { currentStatus: statusArray.currentStatus };

            if (statusArray.isOnHold)
            {
                p.expectedStatus = OrderJob.STATUS.ON_HOLD;
            }
            else if (statusArray.isComplete)
            {
                p.expectedStatus = OrderJob.STATUS.COMPLETED;
            }
            else if (statusArray.isDeleted)
            {
                p.expectedStatus = OrderJob.STATUS.DELETED;
            }
            else if (statusArray.isCanceled)
            {
                p.expectedStatus = OrderJob.STATUS.CANCELED;
            }
            else if (statusArray.isDelivered && statusArray.typeId === OrderJobType.TYPES.TRANSPORT)
            {
                p.expectedStatus = OrderJob.STATUS.DELIVERED;
            }
            else if (statusArray.isPickedUp && statusArray.typeId === OrderJobType.TYPES.TRANSPORT)
            {
                p.expectedStatus = OrderJob.STATUS.PICKED_UP;
            }
            else if (statusArray.isPosted || statusArray.hasRequests)
            {
                p.expectedStatus = OrderJob.STATUS.POSTED;
            }
            else if (statusArray.isPending)
            {
                p.expectedStatus = OrderJob.STATUS.PENDING;
            }
            else if (statusArray.isDeclined)
            {
                p.expectedStatus = OrderJob.STATUS.DECLINED;
            }
            else if (statusArray.isDispatched && statusArray.typeId === OrderJobType.TYPES.TRANSPORT)
            {
                p.expectedStatus = OrderJob.STATUS.DISPATCHED;
            }
            else if (statusArray.isDispatched && !statusArray.isServiceJobCompleted && statusArray.typeId !== OrderJobType.TYPES.TRANSPORT)
            {
                p.expectedStatus = OrderJob.STATUS.IN_PROGRESS;
            }
            else if (statusArray.isServiceJobCompleted && statusArray.typeId !== OrderJobType.TYPES.TRANSPORT)
            {
                p.expectedStatus = OrderJob.STATUS.COMPLETED;
            }
            else if (statusArray.isReady)
            {
                p.expectedStatus = OrderJob.STATUS.READY;
            }
            else if (statusArray.isTender)
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
        {
            // emit event
            emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: state.expectedStatus, oldStatus: state.currentStatus } });

            return state.currentStatus;
        }
        else
        {
            const job = await OrderJob.query()
                .patch(OrderJob.fromJson({ 'status': state.expectedStatus, 'updatedByGuid': currentUser, isComplete: state.expectedStatus === OrderJob.STATUS.COMPLETED, dateCompleted: state.expectedStatus === OrderJob.STATUS.COMPLETED ? DateTime.now().toISO() : null }))
                .findById(jobGuid)
                .returning('status');

            // emit event
            emitter.emit('orderjob_status_updated', { jobGuid, currentUser, state: { status: job.status, oldStatus: state.currentStatus } });

            return state.expectedStatus;
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
            throw new NotFoundError('Job Does Not Exist');
        if (job.isDeleted)
            throw new DataConflictError('Job Is Deleted And Can Not Be Marked As Delivered.');
        if (job.isCanceled)
            throw new DataConflictError(400, 'Job Is Canceled And Can Not Be Marked As Delivered.');
        if (!job.vendorGuid)
            throw new MissingDataError(400, 'Job Has No Vendor Assigned');

        for (const commodity of job.commodities)
            if (commodity.deliveryStatus !== OrderJob.STATUS.DELIVERED)
            {
                const { make, model, year } = commodity.vehicle;
                const commodityId = make && model && year ? `${make}-${model}-${year}` : commodity.vehicleId;
                throw new DataConflictError(`Job's Commodity ${commodityId} Has Not Been Delivered`);
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
        throw new DataConflictError('Job Could Not Be Mark as Delivered, Please Check All Stops Are Delivered');
    }

    static async dispatchServiceJob(jobGuid, body, currentUser)
    {
        const trx = await OrderJobDispatch.startTransaction();
        const {
            vendor: { guid: vendorGuid } = {},
            agent: { guid: agentGuid, ...agentInfo } = {},
            contact: { guid: contactGuid, ...contactInfo } = {},
            paymentTerm, price, dispatchDate
        } = body ?? {};

        try
        {
            // to collect and throw serviceJob and vendor errors
            const appResponse = new AppResponse();

            const [serviceJob, vendor] = await Promise.all([OrderJob.query(trx).withGraphFetched('[bills, stops(distinct)]').findById(jobGuid), SFAccount.query(trx).withGraphFetched('rectype').findById(vendorGuid)]);

            appResponse.addError(...OrderJob.validateReadyServiceJobToInProgress(serviceJob));
            appResponse.addError(...SFAccount.validateAccountForServiceJob(vendor));
            appResponse.throwErrorsIfExist();

            // get agent and contact info and validate
            const [agent, contact] = await Promise.all([OrderJobService.manageContactAccount(trx, vendor, agentGuid, agentInfo, 'Agent'), OrderJobService.manageContactAccount(trx, vendor, contactGuid, contactInfo, 'Contact')]);

            const promises = [];
            const dateStarted = DateTime.now().toISO();

            // unshift is used to ensure dispatch response is always first in Promise.all array
            promises.unshift(OrderJobDispatch.query(trx).insertAndFetch({
                jobGuid: serviceJob.guid,
                vendorGuid: vendor.guid,
                vendorContactGuid: contact?.guid ?? null,
                vendorAgentGuid: agent?.guid ?? null,
                createdByGuid: currentUser,
                updatedByGuid: currentUser,
                isAccepted: true,
                isValid: true,
                isPending: false,
                isDeclined: false,
                isDeleted: false,
                isCanceled: false,
                dateAccepted: dateStarted,
                paymentTermId: paymentTerm,
                price: price
            }));

            promises.push(serviceJob.$query(trx).patch({
                vendorGuid: vendor.guid,
                vendorContactGuid: contact?.guid ?? null,
                vendorAgentGuid: agent?.guid ?? null,
                dateStarted,
                status: OrderJob.STATUS.IN_PROGRESS,
                updatedByGuid: currentUser
            }));

            promises.push(
                InvoiceBill.query(trx)
                    .findByIds(serviceJob.bills.map(bill => bill.guid))
                    .whereNull('consigneeGuid')
                    .patch({
                        consigneeGuid: vendor.guid
                    })
            );

            // Set scheduled date on the first pickup stop
            const [firstPickUpStop] = OrderStop.firstAndLast(serviceJob?.stops);
            firstPickUpStop.setScheduledDates(dispatchDate.dateType, dispatchDate.startDate, dispatchDate?.endDate);
            firstPickUpStop.setUpdatedBy(currentUser);

            promises.push(OrderStop.query(trx).patch(firstPickUpStop).findById(firstPickUpStop.guid));

            const [dispatch] = await Promise.all(promises);

            await trx.commit();

            emitter.emit('orderjob_service_dispatched', { jobGuid: serviceJob.guid, dispatchGuid: dispatch.guid, currentUser });
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async manageContactAccount(trx, vendor, contactAccountGuid, contactAccountInfo, type)
    {
        let contactAccount = null;

        // validate info coming from body
        if (contactAccountGuid || Object.keys(contactAccountInfo).length)
        {
            if (contactAccountGuid)
            {
                contactAccount = await SFContact.query(trx).modify('byId', contactAccountGuid).first();
                if (!contactAccount)
                    throw new NotFoundError(`${type} not found. Please select a valid ${type.toLowerCase()}.`);
                if (contactAccount.accountId !== vendor.sfId)
                    throw new DataConflictError(`${type} is not associated with this vendor.`);
            }
            else
                contactAccount = await SFContact.query(trx).insertAndFetch(SFContact.fromJson(contactAccountInfo));

            // associate contact account with vendor
            await contactAccount.$query(trx).patch({
                accountId: vendor.sfId
            });
        }

        return contactAccount;
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
            throw new NotFoundError('Job does not exist');
        if (job.isDeleted)
            throw new DataConflictError('Job Is Deleted And Can Not Be Marked As Delivered.');
        if (job.isCanceled)
            throw new DataConflictError('Job Is Canceled And Can Not Be Marked As Delivered.');
        if (job.status !== OrderJob.STATUS.DELIVERED && job.status !== OrderJob.STATUS.PICKED_UP)
            throw new DataConflictError('Job Must First Be Delivered');

        // attempt to update status
        const jobStatus = await OrderJobService.updateStatusField(jobGuid, currentUser);

        // if updated successfully
        if (jobStatus === OrderJob.STATUS.PICKED_UP)
        {
            emitter.emit('orderjob_picked_up', { jobGuid, dispatcherGuid: currentUser, orderGuid: job.orderGuid });
            return { status: 204 };
        }

        // if we are here, we failed to update status
        throw new DataConflictError('Job Could Not Be Marked as Picked Up, Please Check All Stops Are Picked Up');
    }

    /**
     * Returns the number of 'pick up' stops that are completed, we group by guid when there are multiple commodities per stop
     * that way we can treat them as 1 stop.
     */
    static async getNumberOfPickupsInProgress(jobGuid)
    {
        const pickupsGroupByStop = OrderStop.query().alias('OS').select('guid', 'OS.isCompleted')
            .innerJoin('rcgTms.orderStopLinks', 'guid', 'stopGuid')
            .where('jobGuid', jobGuid)
            .andWhere('OS.stopType', 'pickup')
            .groupBy('OS.guid', 'OS.isCompleted');

        return OrderStop.query().alias('OS2').select(raw('count(CASE WHEN o_s2.is_completed THEN 1 END) as pickups_in_progress'))
            .with('pickupsGroupByStop', pickupsGroupByStop)
            .innerJoin('pickupsGroupByStop', 'pickupsGroupByStop.guid', 'OS2.guid');
    }

    /**
     * Returns true if the job only has one 'delivery' stop not completed, we group by guid when there are multiple commodities per stop
     * that way we can treat them as 1 stop.
     */
    static async isJobStatusForLastDelivery(jobGuid)
    {

        const deliveriesGroupByStop = OrderStop.query().alias('OS').select('guid', 'OS.isCompleted')
            .innerJoin('rcgTms.orderStopLinks', 'guid', 'stopGuid')
            .where('jobGuid', jobGuid)
            .andWhere('OS.stopType', 'delivery')
            .groupBy('OS.guid', 'OS.isCompleted');

        return OrderStop.query().alias('OS2').select(raw(`
            case when (count(CASE WHEN deliveries_group_by_stop.is_completed THEN 1 END)) = count(deliveries_group_by_stop.guid) - 1 
            then true else false end as is_status_for_last_delivery
        `))
            .with('deliveriesGroupByStop', deliveriesGroupByStop)
            .innerJoin('deliveriesGroupByStop', 'deliveriesGroupByStop.guid', 'OS2.guid');
    }

    static async checkJobToDelete(jobGuid, trx)
    {
        const jobStatus = [
            OrderJob.query(trx)
                .alias('job')
                .select('job.orderGuid', 'job.isDeleted', 'job.status', 'job.vendorGuid')
                .findOne('job.guid', jobGuid)
                .modify('isServiceJob')
                .modify('vendorName'),

            OrderJob.query(trx)
                .alias('job')
                .select('guid')
                .findOne('guid', jobGuid)
                .modify('statusDispatched'),

            OrderJob.query(trx)
                .findOne('guid', jobGuid)
                .modify('canServiceJobMarkAsDeleted')
        ];

        const [job, jobIsDispatched, canServiceJobMarkAsDeleted] = await Promise.all(jobStatus);

        if (!job)
            throw new NotFoundError('Job does not exist');

        job.jobIsDispatched = jobIsDispatched;
        job.canServiceJobMarkAsDeleted = canServiceJobMarkAsDeleted?.canbemarkasdeleted;
        job.validateJobForDeletion();

        return job;
    }

    static async checkJobToAddHold(jobGuid, trx)
    {

        // Use modifier "isServiceJob" and "canServiceJobMarkAsOnHold" for service job validations
        const job = await OrderJob.query(trx)
            .alias('job')
            .select('job.guid', 'job.number', 'job.orderGuid', 'job.status')
            .findById(jobGuid)
            .withGraphFetched('[loadboardPosts(getPosted), dispatches(activeDispatch), requests(validActive)]')
            .modifyGraph('loadboardPosts', builder => builder
                .select('loadboardPosts.guid', 'loadboard', 'externalGuid')
                .orWhere({ loadboard: 'SUPERDISPATCH' }))
            .modifyGraph('dispatches', builder => builder.select('orderJobDispatches.guid'))
            .modifyGraph('requests', builder => builder.select('loadboardRequests.guid'))
            .modify('isServiceJob')
            .modify('canServiceJobMarkAsOnHold')
            .groupBy('job.guid', 'job.number', 'job.orderGuid', 'job.status', raw('"isServiceJob"'));

        if (!job)
            throw new NotFoundError('Job not found');

        job.validateJobToAddHold();

        return job;
    }

    static async getRateConfirmation(jobGuid)
    {
        return OrderJobService.#getDocumentData(jobGuid, {});
    }

    static async getCarrierBOL(jobGuid)
    {
        return OrderJobService.#getDocumentData(jobGuid, {})
            .then(data =>
            {
                delete data.bills;
                return data;
            });
    }

    static async #getDocumentData(jobGuid, options)
    {
        const query = OrderJob.query()
            .findById(jobGuid)
            .withGraphFetched(OrderJob.fetch.fullData)
            .withGraphFetched({ dispatches: OrderJobDispatch.fetch.fullData })
            .withGraphFetched(OrderJob.fetch.billingData)
            .select([
                'rcgTms.orderJobs.guid',
                'rcgTms.orderJobs.number',
                'rcgTms.orderJobs.distance',
                'rcgTms.orderJobs.loadType',
                'rcgTms.orderJobs.instructions'
            ])
            .modifyGraph('stops', qb =>
            {
                qb.select([
                    'guid',
                    'stopType',
                    'sequence',
                    'notes',
                    'dateScheduledStart',
                    'dateScheduledEnd',
                    'dateScheduledType',
                    'dateRequestedStart',
                    'dateRequestedEnd',
                    'dateRequestedType'
                ]);
            })
            .modifyGraph('stops.commodities', qb =>
            {
                qb.where('jobGuid', jobGuid)
                    .distinctOn('stopGuid', 'commodityGuid');
            })
            .modifyGraph('stops.terminal', qb =>
            {
                qb.select([
                    'name',
                    'guid',
                    'locationType',
                    'street1',
                    'street2',
                    'state',
                    'city',
                    'country',
                    'zipCode',
                    'latitude',
                    'longitude'
                ]);
            })
            .modifyGraph('dispatches', qb =>
            {
                qb.select(['guid', 'dateAccepted'])
                    .findOne({
                        isValid: true,
                        isCanceled: false,
                        isDeclined: false
                    })
                    .orderBy('dateCreated', 'desc');
            })
            .modifyGraph('bills', qb =>
            {
                qb.select(['guid']);
            })
            .modifyGraph('bills.lines', qb =>
            {
                qb.select(['amount', 'dateCreated', 'dateCharged']);
            });

        // strict select fields for the SFAccount
        for (const path of ['vendor', 'dispatches.vendor', 'bills.consignee'])
        {
            query.modifyGraph(path, qb =>
            {
                qb.select([
                    'billingCity',
                    'billingCountry',
                    'billingPostalCode',
                    'billingLatitude',
                    'billingLongitude',
                    'billingState',
                    'billingStreet',
                    'email',
                    'guid',
                    'name',
                    'phoneNumber',
                    'dotNumber',
                    raw('\'carrier\' as rtype')
                ]);
            });
        }

        // strict select fields for the Commodities in the Order

        for (const path of ['stops.commodities', 'bills.lines.commodity'])
        {
            query.modifyGraph(path, qb =>
            {
                qb.select([
                    'guid',
                    'capacity',
                    'damaged',
                    'inoperable',
                    'length',
                    'weight',
                    'quantity',
                    'description',
                    'identifier',
                    'lotNumber'
                ]);
            });
        }

        const orderJobInfo = await query;

        if (orderJobInfo == undefined)
        {
            throw new NotFoundError('This job does not exist');
        }
        orderJobInfo.dispatch = orderJobInfo.dispatches[0];
        delete orderJobInfo.dispatches;

        // sort the stops in the correct sequence
        orderJobInfo.stops.sort((a, b) => a.sequence - b.sequence);

        // normalize the sequence numbers for the stops
        let seq = 1;
        for (const stop of orderJobInfo.stops)
        {
            stop.sequence = seq++;
        }
        return orderJobInfo;
    }

    static async updateCarrierPay(jobGuid, carrierPay, currentUser, trx)
    {

        const systemLineQB = OrderJobService.getSystemLines(jobGuid, 'base_pay');
        systemLineQB.transacting(trx);

        const systemLines = await systemLineQB;

        const billQB = Bill.query(trx).joinRelated('relation')
            .where(qb =>
            {
                qb.orWhere({ 'relation.id': InvoiceBillRelationType.TYPES.CARRIER })
                    .orWhere({ 'relation.id': InvoiceBillRelationType.TYPES.VENDOR });
            })
            .where({ 'jobGuid': jobGuid })
            .select('billGuid');

        const lines = await InvoiceLines.query(trx)
            .modify('isSystemDefined', systemLines.systemUsage)
            .andWhere('itemId', systemLines.lineItemId)
            .whereIn('invoiceGuid', billQB);

        const linesQB = BillService.distributeCostAcrossLines(lines, carrierPay, currentUser);
        for (const qb of linesQB)
            qb.transacting(trx);

        await Promise.all(linesQB);

        emitter.emit('orderjob_pay_updated', jobGuid);
    }

    static async updateTariff(jobGuid, amount, currentUser, trx)
    {
        const systemLineQB = OrderJobService.getSystemLines(jobGuid, 'base_pay');
        systemLineQB.transacting(trx);

        const systemLines = await systemLineQB;

        const billQB = Bill.query(trx).joinRelated('relation')
            .where(qb =>
            {
                qb.orWhere({ 'relation.id': InvoiceBillRelationType.TYPES.CARRIER })
                    .orWhere({ 'relation.id': InvoiceBillRelationType.TYPES.VENDOR });
            })
            .where({ 'jobGuid': jobGuid })
            .select('billGuid');

        const orderQB = OrderJob.query(trx).findById(jobGuid).select('orderGuid');

        const invoiceQB = Invoice.query(trx).joinRelated('relation')
            .where({ 'relation.id': InvoiceBillRelationType.TYPES.CONSIGNEE })
            .whereIn('orderGuid', orderQB)
            .select('invoiceGuid');

        const lines = await InvoiceLines.query(trx).alias('lines')
            .withGraphJoined('[linkOne, linkTwo]')
            .where({ 'lines.itemId': systemLines.lineItemId, 'lines.systemDefined': true, 'lines.systemUsage': 'base_pay' })
            .where('lines.invoiceGuid', 'in', billQB)
            .where(qb =>
            {
                qb.orWhere(qb =>
                {
                    qb.where('linkOne.invoiceGuid', 'in', invoiceQB)
                        .where({ 'linkOne.itemId': systemLines.lineItemId, 'linkOne.systemDefined': true, 'linkOne.systemUsage': 'base_pay' });
                })
                    .orWhere(qb =>
                    {
                        qb.where('linkTwo.invoiceGuid', 'in', invoiceQB)
                            .where({
                                'linkTwo.itemId': systemLines.lineItemId, 'linkTwo.systemDefined': true, 'linkTwo.systemUsage': 'base_pay'
                            });
                    });
            });

        // combine both of the lineOne and lineTwo into one array
        const invoiceLines = lines.reduce((accumilator, line) =>
        {
            accumilator.push(...line.linkOne);
            accumilator.push(...line.linkTwo);
            return accumilator;
        }, []);

        const linesQB = BillService.distributeCostAcrossLines(invoiceLines, amount, currentUser);
        for (const qb of linesQB)
            qb.transacting(trx);

        await Promise.all(linesQB);

        emitter.emit('orderjob_pay_updated', jobGuid);
    }

    static getSystemLines(jobGuid, relationName)
    {
        const jobTypeQB = OrderJob.query().findById(jobGuid).select('typeId');

        return InvoiceSystemLine.query()
            .findOne('systemUsage', relationName).whereIn('jobTypeId', jobTypeQB);
    }
}

module.exports = OrderJobService;
