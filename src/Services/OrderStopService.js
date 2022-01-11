const HttpError = require('../ErrorHandling/Exceptions/HttpError');
const OrderStopLinks = require('../Models/OrderStopLink');
const knex = require('../Models/BaseModel').knex();
const emitter = require('../EventListeners/index');
const OrderStops = require('../Models/OrderStop');

class OrderStopService
{
    /**
     * @param {Object} param0 Payload that will be modified.
     * @param {uuid} param0.jobGuid - UUID of the job.
     * @param {uuid} param0.stopGuid - UUID of the stop that is being updated.
     * @param {string} param0.status - the status of the stop that is being modified.
     * @param {Object} param1 Payload which will cause the modification.
     * @param {[uuid]} param1.commodities - List of commodities that will be affecting the change
     * @param {string} param1.date - date value for updating stop status
     * @returns {Object} Stop - modified stop.
     */
    static async updateStopStatus({ jobGuid, stopGuid, status }, { commodities, date }, currentUser)
    {
        // combining commodities for hstore string
        const hstoreValue = commodities.map((value) => { return `${value} => 1`; });

        // init transaction
        const trx = await knex.transaction();

        /**
         * raw query to verify if provided guid exist in tables
         * check to see if job exist
         * if stop exist
         * if commodities that were provided exists
         * if changing pickup, check if commodity has not be delivered
         */
        const [
            jobRes,
            jobStop,
            dbCommodities,
            illegalPickUp
        ] = await knex.raw(`
            SELECT * FROM rcg_tms.order_jobs oj WHERE guid = '${jobGuid}';
            SELECT * FROM rcg_tms.order_stops os WHERE os.guid = '${stopGuid}';
            SELECT akeys(hstore('${hstoreValue.join(',')}') - hstore(array_agg(c.guid), array_agg(c.digit))) AS guid
            FROM(SELECT guid:: text, '1' AS digit FROM rcg_tms.commodities WHERE guid IN ('${commodities.join('\',\'')}') ) c;
            SELECT * 
            FROM rcg_tms.order_stop_links osl
            LEFT JOIN rcg_tms.order_stops os ON os.guid = osl.stop_guid
            WHERE osl.stop_guid = '${stopGuid}' 
            AND os.stop_type = 'pickup'
            AND osl.job_guid = '${jobGuid}'
            AND EXISTS (
            	SELECT * 
            	FROM rcg_tms.order_stop_links osl2
            	LEFT JOIN rcg_tms.order_stops os2 ON os2.guid = osl2.stop_guid
            	WHERE os2.stop_type = 'delivery'  
            	AND osl2.job_guid = osl.job_guid
            	AND osl2.is_completed = true
            );
        `);

        // convert to a POJO unfortunately it is all snake_case
        const job = jobRes.rows.shift();

        // getting order guid for updating commodities
        const orderGuid = job.order_guid;

        // if job doesn't exist
        if (!job)
        {
            throw new HttpError(404, 'Job does not exist');
        }

        // if stop doens't exist
        if (!jobStop.rows[0])
        {
            throw new HttpError(404, 'Stop does not exist');
        }

        // throw error on commodities that don't exist
        if (dbCommodities.rows[0].guid == null || dbCommodities.rows[0].guid.length > 0)
        {
            let comms;
            if (dbCommodities.rows[0].guid == null)
            {
                comms = commodities;
            }
            else
            {
                comms = dbCommodities.rows[0].guid;
            }
            const error = new HttpError(404, 'Commodities do not exist');
            error.commodities = comms;
            throw error;
        }

        // If the job is on hold, something is wrong with it and its stops should not be able to be updated
        if (job.is_on_hold)
        {
            throw new HttpError(400, 'Please remove the hold on this job before updating pickup or delivery dates');
        }

        // Throw error when clearing pickup location if delivery is completed
        if (date == null && illegalPickUp.rows[0] != undefined)
        {
            throw new HttpError(400, `Pickup/Delivery stop ${illegalPickUp.rows[0].stop_guid} cannot clear status ${status} because the commodity '${illegalPickUp.rows[0].commodity_guid}' is marked as delivered`);
        }

        /**
         * After validating of all passed in parameters we need to update the stop link
         * if the date is null we will be clearing the inputs and setting them to false
         * if date is passed in we will be updating those fields accordingly.
         * if the status is started we clear both the started and completed feilds
         * if the status is completed, then we only update the completed date and flags.
         */
        try
        {
            // stopLink query builder
            const StopLinksQuery = OrderStopLinks.query(trx);

            const stopLinksUpdate = { 'updatedByGuid': currentUser };

            // updating or clearing job stop links depending on status
            if (status === 'started' && date == null)
                Object.assign(stopLinksUpdate, { 'isStarted': false, 'dateStarted': date, 'isCompleted': false, 'dateCompleted': date });
            else if (status === 'started' && date != null)
                Object.assign(stopLinksUpdate, { 'isStarted': true, 'dateStarted': date });
            else if (status === 'completed' && date == null)
                Object.assign(stopLinksUpdate, { 'isStarted': false, 'dateStarted': date, 'isCompleted': false, 'dateCompleted': date });
            else if (status === 'completed' && date != null)
                Object.assign(stopLinksUpdate, { 'isStarted': true, 'dateStarted': date, 'isCompleted': true, 'dateCompleted': date });

            // updating job stop link
            await StopLinksQuery.modify('jobStop', jobGuid, stopGuid).whereIn('commodityGuid', commodities).patch(stopLinksUpdate);

            // validate order stop links and stop that has been updated
            await OrderStopService.validatestopLinksandStop([stopGuid], jobGuid, commodities, trx, currentUser);

            // TODO: make it an event
            // update all commodities to pick up or delivered
            await OrderStopService.updateCommoditiesStatus(orderGuid, commodities, trx, currentUser);

            // commit transaction
            await trx.commit();

            // we emit event that stop has been updated
            emitter.emit('orderjob_stop_update', { orderGuid, jobGuid, currentUser, jobStop: jobStop.rows[0], stopGuid });
        }
        catch (error)
        {
            await trx.rollback();
            throw new HttpError(400, error);
        }

        // query for the stop and return to the front end
        const stop = await OrderStops.query().findById(stopGuid);

        // return stop that was updated
        return stop;
    }

    /**
     * The method will take in parameters and validated the stops.
     * @param {[uuid]} stopGuids - list of stop UUIDs.
     * @param {uuid} jobGuid - job UUID that will be passed in.
     * @param {[uuid]} commodities - list of commodities uuid's.
     * @param {Object} trx - transaction object.
     * @returns
     */
    static async validatestopLinksandStop(stopGuids, jobGuid, commodities, trx, currentUser)
    {
        // array to hold multiple executions
        const promiseArrays = [];

        // loop through array of stopGUID's
        for (const stopGuid of stopGuids)
        {
            // connect all the update stings into one string
            const updateQuery =
                OrderStopService.updateOrderStopLinks(stopGuid, jobGuid, commodities, currentUser)
                + OrderStopService.updateOrderStop(stopGuid, currentUser)
                + OrderStopService.updateStopStatusField(stopGuid, currentUser);

            // push knex raw with transaction into the array
            promiseArrays.push(knex.raw(updateQuery).transacting(trx));
        }

        // execute all promises
        await Promise.all(promiseArrays);

        // return nothing
        return;
    }

    /**
     * this method will be updating Order stop links status from the job status per commodity that exists
     * if one job stop link is marked as started the order stop link will be update to started as will the flag
     * if all job links are marked complete, we update the order stop link complete boolean and date other wise not complete
     * if any of them are marked started, we can update the order stop links as started
     * the validation will clear all the fields depending on the logic in the tables
     * @param {uuid} stopGuid - uuid of the stop
     * @param {uuid} jobGuid - uuid of the job
     * @param {[uuid]} commodities - list of commodity guid's
     * @returns {String} QueryString
     */

    static updateOrderStopLinks(stopGuid, jobGuid, commodities, currentUser)
    {
        return `
        UPDATE rcg_tms.order_stop_links AS link
            SET 
            updated_by_guid = '${currentUser}',
            is_started = (
            						SELECT 
            						CASE WHEN count(*) >= 1 then
            							cast ( 1 AS BOOLEAN)
            						ELSE
            							cast ( 0 AS BOOLEAN)
            						END AS is_started 
            						FROM rcg_tms.order_stop_links link2
            						WHERE link2.commodity_guid = link.commodity_guid
            						AND link2.stop_guid = link.stop_guid
            						AND link2.is_started 
            						AND link2.job_guid IS NOT NULL
            						AND link2.order_guid = link.order_guid),
            date_started = COALESCE(
            						(	SELECT date_started 
            							FROM rcg_tms.order_stop_links link3 
            							WHERE link3.stop_guid = link.stop_guid
            							AND link3.commodity_guid = link.commodity_guid
            							AND link3.job_guid IS NOT NULL
            							AND link3.order_guid = link.order_guid ORDER BY date_started ASC limit 1 )   ),
            is_completed = ( SELECT bool_and(is_completed) as myresult 
            						FROM (
            						SELECT is_completed
            						FROM rcg_tms.order_stop_links link3 
            						WHERE link3.order_guid = link.order_guid
            						AND link3.commodity_guid = link.commodity_guid 
            						AND link3.job_guid IS NOT NULL
            						AND link3.stop_guid = link.stop_guid )    t),
            date_completed = COALESCE(
            						(	SELECT date_completed
            							FROM rcg_tms.order_stop_links link4 
            							WHERE link4.stop_guid = link.stop_guid
            							AND link4.commodity_guid = link.commodity_guid 
            							AND link4.job_guid IS NOT NULL
            							AND link4.order_guid = link.order_guid ORDER BY date_completed DESC limit 1 )   )
            FROM rcg_tms.order_stops stop, rcg_tms.order_jobs job
            WHERE stop.guid = link.stop_guid
            AND link.commodity_guid IN ('${commodities.join('\',\'')}')
            AND link.stop_guid = '${stopGuid}'
            AND link.job_guid IS NULL
            AND job.guid = '${jobGuid}'
            AND link.order_guid = job.order_guid;
        `;
    }

    /**
     * This method will be returning a update query string that will modify stop guid.
     * if one job stop link is marked as started the order stop will be update started flag and the earlierst start date
     * if all job links are marked complete, we update the order stop complete flag and date to be complete
     * @param {uuid} stopGuid - uuid of the stop
     * @returns {String} QueryString
     */
    static updateOrderStop(stopGuid, currentUser)
    {
        return `
        UPDATE rcg_tms.order_stops as stop 
            SET
            updated_by_guid = '${currentUser}',
            is_started = (
            						SELECT 
            						CASE WHEN count(*) >= 1 then
            							cast ( 1 AS BOOLEAN)
            						ELSE
            							cast ( 0 AS BOOLEAN)
            						END AS is_started 
            						FROM rcg_tms.order_stop_links link2
            						WHERE link2.stop_guid = stop.guid
            						AND link2.is_started 
            						AND link2.job_guid IS NOT NULL
            						AND link2.order_guid = link.order_guid), -- create logic
            date_started = COALESCE(
            						(	SELECT date_started 
            							FROM rcg_tms.order_stop_links link3 
            							WHERE link3.stop_guid = stop.guid
            							AND link3.job_guid IS NOT NULL
            							AND link3.order_guid = link.order_guid ORDER BY date_started asc nulls last limit 1  )   ),
            is_completed = ( SELECT bool_and(is_completed) as myresult 
            						FROM (
            						SELECT is_completed
            						FROM rcg_tms.order_stop_links link3 
            						WHERE link3.order_guid = link.order_guid 
            						AND link3.job_guid IS NOT NULL
            						AND link3.stop_guid = stop.guid )    t), -- logic
            date_completed = COALESCE(
            						(	SELECT date_completed
            							FROM rcg_tms.order_stop_links link4 
            							WHERE link4.stop_guid = stop.guid
            							AND link4.job_guid IS NOT NULL
            							AND link4.order_guid = link.order_guid ORDER BY date_completed DESC limit 1 )   )
            FROM rcg_tms.order_stop_links link
            WHERE stop.guid = '${stopGuid}'
            AND stop.guid = link.stop_guid;        
        `;
    }

    /**
     * This method will return a string with update query that will modify the status field in order stop
     * The case scinario considers cases of pickup and deliver and also includes service type stops
     * @param {uuid} stopGuid
     * @returns {String} QueryString
     */
    static updateStopStatusField(stopGuid, currentUser)
    {
        return `
            UPDATE rcg_tms.order_stops as stop
            SET
                updated_by_guid = '${currentUser}',
            	status = CASE 
            				WHEN is_started = false AND is_completed = false then NULL
            				WHEN stop_type = 'pickup' AND is_started = true AND is_completed = true THEN 'picked up'
            				WHEN (stop_type = 'pickup' OR stop_type = 'delivery') AND is_completed = false AND is_started = true THEN 'en route'
            				WHEN stop_type = 'delivery' and is_started = true and is_completed = true then 'delivered'
            				WHEN stop_type IS NULL and is_started = true AND is_completed = false THEN 'started'
            				WHEN stop_type IS NULL and is_started = true AND is_completed = true THEN 'completed'
            			END 
            WHERE guid = '${stopGuid}';        
        `;
    }

    /**
     * at this point all the job and order stops are updated, we can check if the commodities are picked up or delivered
     * we select all the stopLinks that for that commodity from that order
     * for each commodity we check if all the links are completed and if at least one of them is started
     * if all of them are completed, we can update the commodity as delivered
     * if any of them are started, we can update the commodity as picked up
     * @param {uuid} orderGuid - guid of the Order
     * @param {[uuid]} commodities - list of commodity guid's
     * @param {Object} trx - transaction that will be passed in
     */
    static async updateCommoditiesStatus(orderGuid, commodities, trx, currentUser)
    {
        await knex.raw(`
        UPDATE rcg_tms.commodities
            SET
            updated_by_guid = '${currentUser}', 
            delivery_status =
                CASE
                    WHEN completed = count THEN 'delivered'::rcg_tms.delivery_status_types
                    WHEN completed != count AND started > 0 THEN 'picked up'::rcg_tms.delivery_status_types
                    ELSE 'none'::rcg_tms.delivery_status_types
                END
            FROM
                (SELECT commodity_guid, COUNT(*) AS COUNT,
                    SUM(CASE WHEN is_started = true THEN 1 ELSE 0 END) AS started,
                    SUM(CASE WHEN is_completed = true THEN 1 ELSE 0 END) AS completed
                    FROM rcg_tms.order_stop_links links
                    WHERE links.commodity_guid IN
                    ('${commodities.join('\',\'')}')
                    AND links.order_guid = '${orderGuid}'
                GROUP BY commodity_guid) as subquery
            WHERE guid = subquery.commodity_guid`).transacting(trx);
    }
}

module.exports = OrderStopService;