const OrderStopLink = require('../Models/OrderStopLink');
const knex = require('../Models/BaseModel').knex();
const { DateTime } = require('luxon');

class OrderStopService
{
    static async updateStopStatus({ jobGuid, stopGuid, status }, { commodities, date })
    {
        // init transaction
        const trx = await knex.transaction();

        // validate date (can remove this if we will rely on openapi validation)
        if (!DateTime.fromISO(date).isValid)
            throw new Error('Invalid date');

        // first update the job stop links
        let linksQuery = `UPDATE rcg_tms.order_stop_links
                 SET
                    is_started = COALESCE(NULLIF(is_started, false), true),
                    date_started = COALESCE(NULLIF(date_started, NULL), '${date}')`;

        if (status === 'completed')
            linksQuery += `, is_completed = COALESCE(NULLIF(is_completed, false), true),
                           date_completed = COALESCE(NULLIF(date_completed, NULL), '${date}')`;

        // append conditions (job_guid IS NULL should take care of updating the respective order stoplink)
        linksQuery += ` WHERE (job_guid = '${jobGuid}' OR job_guid IS NULL) AND stop_guid = '${stopGuid}' AND commodity_guid IN ('${commodities.join('\',\'')}')
                        RETURNING order_guid`;

        // update all the links, we need order_guid to update order links after this
        await knex.raw(linksQuery).transacting(trx);

        // check if all the links are completed for this stop
        const stopLinks = await OrderStopLink.query().where({ 'stop_guid': stopGuid, 'is_completed': false });

        // calculate stop status
        let stopQuery = `UPDATE rcg_tms.order_stops
                         SET
                            is_started = COALESCE(NULLIF(is_started, false), true),
                            date_started = COALESCE(NULLIF(date_started, NULL), '${date}')`;

        // if all the order stop links are completed for this stop, update the order stop
        if (stopLinks.length === 0)
            stopQuery += `, is_completed = COALESCE(NULLIF(is_completed, false), true),
                            date_completed = COALESCE(NULLIF(date_completed, NULL), '${date}'),
                            status = 
                            CASE 
                                WHEN stop_type = 'pickup' THEN 'Picked Up'
                                WHEN stop_type = 'delivery' THEN 'Delivered'
                            END`;
        else
            stopQuery += ', status = \'En Route\'';

        // append conditions
        stopQuery += ` WHERE guid = '${stopGuid}'`;

        await knex.raw(stopQuery).transacting(trx);

        // commit transaction
        await trx.commit();

        return stopLinks;
    }
}

module.exports = OrderStopService;