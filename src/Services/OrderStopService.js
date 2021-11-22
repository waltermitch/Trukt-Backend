const knex = require('../Models/BaseModel').knex();
const Commodity = require('../Models/Commodity');
const { DateTime } = require('luxon');

class OrderStopService
{
    static async updateStopStatus({ jobGuid, stopGuid, status }, { commodities, date })
    {
        // init transaction
        const trx = await knex.transaction();

        // first we want to update the the job stop links
        // validate date (can remove this if we will rely on openapi validation)
        if (!DateTime.fromISO(date).isValid)
            throw new Error('Invalid date');

        // first update the job stop links and the commodities
        let linksQuery = `UPDATE rcg_tms.order_stop_links
                 SET `;

        if (status === 'started')
            linksQuery += `is_started = true,
                        date_started = '${date}'`;
        else if (status === 'completed')
            linksQuery += ` is_started = true,
                            is_completed = true,
                            date_started = COALESCE(date_started, '${date}'),
                            date_completed = '${date}'`;

        // append conditions (job_guid IS NULL should take care of updating the respective order stoplink)
        linksQuery += ` WHERE job_guid = '${jobGuid}' AND stop_guid = '${stopGuid}' AND commodity_guid IN ('${commodities.join('\',\'')}')`;

        // update all the links, we need order_guid to update order links after this
        await knex.raw(linksQuery).transacting(trx);

        // get all stoplinks for this stop and get all stoplinks for all the commodities
        const stopLinks = (await knex.raw(`SELECT id, stop_guid, order_guid, is_completed, is_started, date_started, date_completed FROM rcg_tms.order_stop_links WHERE job_guid = '${jobGuid}' and stop_guid = '${stopGuid}'`).transacting(trx)).rows;

        // save order_guid for later
        const orderGuid = stopLinks[0].order_guid;

        // next we want to update the Order stop links depending on the status of the job stop links
        // if all of them are marked complete, we can update the order stop links as complete
        // if any of them are marked started, we can update the order stop links as started
        // if all of them are marked started and complete, we can update the order stop links as started and completed
        // check if all the links are completed for this stop
        // also save the earliest date_started out of all the links
        let allCompleted = true;
        let allStarted = true;
        let earliestStarted = date;
        for (const link of stopLinks)
        {
            if (!link.is_completed)
                allCompleted = false;

            if (!link.is_started)
                allStarted = false;

            if (link.date_started)
                earliestStarted = earliestStarted < link.date_started ? earliestStarted : link.date_started;
        }

        let orderStopLinksQuery = `UPDATE rcg_tms.order_stop_links
                                        SET `;

        // if all the links are completed, we can update the order stop links as complete
        if (allStarted && allCompleted)
            orderStopLinksQuery += `is_completed = true,
                                    date_completed = '${date}'`;
        else
            orderStopLinksQuery += `is_started = true,
                                    date_started = '${earliestStarted}'`;

        // append conditions
        orderStopLinksQuery += ` WHERE order_guid = '${orderGuid}' AND stop_guid = '${stopGuid}' AND commodity_guid IN ('${commodities.join('\',\'')}') AND job_guid IS NULL`;

        // calculate stop status
        let stopQuery = `UPDATE rcg_tms.order_stops
                         SET
                            is_started = true,
                            date_started = '${earliestStarted}'`;

        if (allCompleted)
            stopQuery += `, is_completed = true,
                            date_completed = '${date}',
                            status = 
                            CASE 
                                WHEN stop_type = 'pickup' THEN 'Picked Up'
                                WHEN stop_type = 'delivery' THEN 'Delivered'
                            END`;
        else
            stopQuery += `,status = 
                            CASE 
                                WHEN stop_type = 'pickup' THEN 'Picked Up'
                                WHEN stop_type = 'delivery' THEN 'En Route'
                            END`;

        stopQuery += ` WHERE guid = '${stopGuid}' RETURNING *`;

        // update all the order links and the respective stop
        const [, stop] = await Promise.all([await knex.raw(orderStopLinksQuery).transacting(trx), await knex.raw(stopQuery).transacting(trx)]);

        // at this point all the job and order stops are updated, we can check if the commodity is picked up or delivered
        const commodityLinks = await knex.raw(`SELECT id, commodity_guid, is_completed, is_started, date_started, date_completed FROM rcg_tms.order_stop_links WHERE order_guid = '${orderGuid}' AND commodity_guid IN ('${commodities.join('\',\'')}')`).transacting(trx);

        // check if all the commodities are completed or started
        let allCommoditiesCompleted = true;
        let allCommoditiesStarted = true;
        for (const link of commodityLinks.rows)
        {
            if (!link.is_completed)
                allCommoditiesCompleted = false;

            if (!link.is_started)
                allCommoditiesStarted = false;
        }

        // if all the commodity links are completed, we can update the commodity as delievered
        let commodityQuery = `UPDATE rcg_tms.commodities
                                    SET `;

        if (allCommoditiesCompleted && allCommoditiesStarted)
            commodityQuery += 'delivery_status = \'delivered\' ';
        else
            commodityQuery += 'delivery_status = \'picked up\' ';

        // append conditions
        commodityQuery += ` WHERE guid IN ('${commodities.join('\',\'')}')`;

        // update all the commodities
        await knex.raw(commodityQuery).transacting(trx);

        // commit transaction
        await trx.commit();

        return stop.rows[0];
    }
}

module.exports = OrderStopService;