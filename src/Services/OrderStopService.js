const knex = require('../Models/BaseModel').knex();
const OrderStops = require('../Models/OrderStop');
const OrderStopLinks = require('../Models/OrderStopLink');
const { DateTime } = require('luxon');
const { raw } = require('objection');

class OrderStopService
{
    static async updateStopStatus({ jobGuid, stopGuid, status }, { commodities, date })
    {
        // combining commodities for hstore string
        const hstoreValue = commodities.map((value) => { return `${value} => 1`; });

        // init transaction
        const trx = await knex.transaction();

        // raw query to verify if provided guid exist in tables
        const [job, jobStop, myCommodities] = await knex.raw(`
            SELECT * FROM rcg_tms.order_jobs oj WHERE guid = '${jobGuid}';
            SELECT * FROM rcg_tms.order_stops os WHERE os.guid = '${stopGuid}';
            SELECT akeys(hstore('${hstoreValue.join(',')}') - hstore(array_agg(c.guid), array_agg(c.digit))) AS guid
            FROM(SELECT guid:: text, '1' AS digit FROM rcg_tms.commodities WHERE guid IN ('${commodities.join('\',\'')}') ) c;
        `);

        // if job doesn't exist
        if (!job.rows[0])
        {
            throw new Error('Job Does not exist');
        }

        // if stop doens't exist
        if (!jobStop.rows[0])
        {
            throw new Error('Stop does not exist');
        }

        // throw error on commodities that don't exist
        if (myCommodities.rows[0]?.guid[0] !== undefined)
        {
            throw new Error(`Commodity ${myCommodities.rows[0]?.guid} does not exist`);
        }

        // first we want to update the the job stop links
        // validate date (can remove this if we will rely on openapi validation)
        if (!DateTime.fromISO(date).isValid)
            throw new Error('Invalid date');

        // first update the job stop links and the commodities
        const StopLinksQuery = OrderStopLinks.query(trx);

        if (status === 'started')
            StopLinksQuery.patch({ 'isStarted': true, 'dateStarted': date });
        else if (status === 'completed')
            StopLinksQuery.patch({ 'isStarted': true, 'isCompleted': true, 'dateStarted': raw(`COALESCE(date_started, '${date}')`), 'dateCompleted': date });

        // update all the links, we need order_guid to update order links after this
        await StopLinksQuery.modify('jobStop', jobGuid, stopGuid).modify('commoditiesIn', commodities);

        const { orderGuid, stop } = await OrderStopService.validateStopLinks([stopGuid], date, trx);

        // at this point all the job and order stops are updated, we can check if the commodities are picked up or delivered
        // we select all the stopLinks that for that commodity from that order
        // for each commodity we check if all the links are completed and if at least one of them is started
        // if all of them are completed, we can update the commodity as delivered
        // if any of them are started, we can update the commodity as picked up
        await knex.raw(`
        UPDATE rcg_tms.commodities
            SET delivery_status =
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

        // commit transaction
        await trx.commit();

        // updateStop
        return stop;
    }

    static async validateStopLinks(stopGuids, date = '', trx)
    {
        // to handle if the date is not passes in
        const now = DateTime.utc().toString();

        // array to hold multiple promises
        const promiseArray = [];

        let orderGuid;

        // looping through multiple stops
        for (const stopGuid of stopGuids)
        {
            // get all stoplinks for this stop and get all stoplinks for all the commodities
            const stopLinks = (await OrderStopLinks.query(trx).select('id', 'stopGuid', 'orderGuid', 'isCompleted', 'isStarted', 'dateStarted', 'dateCompleted').where('stopGuid', stopGuid));

            // save order_guid for later
            orderGuid = stopLinks[0].orderGuid;

            // next we want to update the Order stop links depending on the status of the job stop links
            // if all of them are marked complete, we can update the order stop links as complete
            // if any of them are marked started, we can update the order stop links as started
            // if all of them are marked started and complete, we can update the order stop links as started and completed
            // check if all the links are completed for this stop
            // also save the earliest date_started out of all the links
            let allCompleted = true;
            let allStarted = true;
            let earliestStarted = date != '' ? date : stopLinks[0].isStarted;
            for (const link of stopLinks)
            {
                if (!link.isCompleted)
                    allCompleted = false;

                if (!link.isStarted)
                    allStarted = false;

                if (link.dateStarted)
                    earliestStarted = earliestStarted < link.dateStarted ? earliestStarted : link.dateStarted;
            }

            // start order stop query
            const orderStopLinksQuery = OrderStopLinks.query(trx);

            // if started and completed then update order to completed
            if (allStarted && allCompleted)
                orderStopLinksQuery.update({ 'isCompleted': true, 'dateCompleted': date != '' ? date : now });
            else
                orderStopLinksQuery.update({ 'isStarted': true, 'dateStarted': date != '' ? date : now });

            orderStopLinksQuery
                .modify('orderStop', orderGuid, stopGuid)
                .modify('orderOnly');

            // push order stop links updated to array
            promiseArray.push(orderStopLinksQuery);

            // calculate stop status
            const OrderStopsQuery = OrderStops.query(trx);
            if (allCompleted)
                OrderStopsQuery
                    .update({
                        'isStarted': true,
                        'dateStarted': earliestStarted,
                        'isCompleted': true,
                        'dateCompleted': date != '' ? date : now,
                        status: raw(`CASE
                                WHEN stop_type = 'pickup' THEN 'Picked Up'
                                WHEN stop_type = 'delivery' THEN 'Delivered'
                            END`)
                    });
            else
                OrderStopsQuery
                    .update({
                        'isStarted': true,
                        'dateStarted': earliestStarted,
                        status: raw(`CASE
                                WHEN stop_type = 'pickup' THEN 'Picked Up'
                                WHEN stop_type = 'delivery' THEN 'En Route'
                            END`)
                    });

            OrderStopsQuery.where('guid', stopGuid).returning('*').first();

            // push update query into array
            promiseArray.push(OrderStopsQuery);
        }

        // update all the order links and the respective stop
        const [, updatedStop] = await Promise.all(promiseArray);

        // returning stop
        return { orderGuid: orderGuid, stop: updatedStop };
    }
}

module.exports = OrderStopService;