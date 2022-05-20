
exports.up = async function (knex)
{
    await knex.raw(`
        -- later than scheduled
        UPDATE rcg_tms.order_stops os 
        SET date_scheduled_start = NULL,
        date_scheduled_end = COALESCE (os.date_scheduled_start, os.date_scheduled_end)
        WHERE os.date_scheduled_type = 'no later than';

        -- no earlier than scheduled
        UPDATE rcg_tms.order_stops os 
        SET date_scheduled_start = COALESCE (os.date_scheduled_start, os.date_scheduled_end),
        date_scheduled_end = NULL 
        WHERE os.date_scheduled_type = 'no earlier than';

        -- exactly scheduled
        UPDATE rcg_tms.order_stops os 
        SET date_scheduled_start = COALESCE (os.date_scheduled_start, os.date_scheduled_end),
        date_scheduled_end = COALESCE (os.date_scheduled_start, os.date_scheduled_end) 
        WHERE os.date_scheduled_type = 'exactly';

        -- estimated scheduled 
        UPDATE rcg_tms.order_stops os 
        SET date_scheduled_start = COALESCE (os.date_scheduled_start, os.date_scheduled_end),
        date_scheduled_end = COALESCE (os.date_scheduled_end, os.date_scheduled_start) 
        WHERE os.date_scheduled_type = 'estimated';

        -- later than requested
        UPDATE rcg_tms.order_stops os 
        SET date_requested_start = NULL,
        date_requested_end = COALESCE (os.date_requested_start, os.date_requested_end) 
        WHERE os.date_requested_type = 'no later than';

        -- no earlier than requested
        UPDATE rcg_tms.order_stops os 
        SET date_requested_start = COALESCE (os.date_requested_start, os.date_requested_end),
        date_requested_end = NULL 
        WHERE os.date_requested_type = 'no earlier than';

        -- exactly requested
        UPDATE rcg_tms.order_stops os 
        SET date_requested_start = COALESCE (os.date_requested_start, os.date_requested_end),
        date_requested_end = COALESCE (os.date_requested_start, os.date_requested_end) 
        WHERE os.date_requested_type = 'exactly';

        -- estimated requested 
        UPDATE rcg_tms.order_stops os 
        SET date_requested_start = COALESCE (os.date_requested_start, os.date_requested_end),
        date_requested_end = COALESCE (os.date_requested_end, os.date_requested_start) 
        WHERE os.date_requested_type = 'estimated';

        -- later than estimated
        UPDATE rcg_tms.order_stops os 
        SET date_estimated_start = NULL,
        date_estimated_end = COALESCE (os.date_estimated_start, os.date_estimated_end) 
        WHERE os.date_estimated_type = 'no later than';

        -- no earlier than estimated
        UPDATE rcg_tms.order_stops os 
        SET date_estimated_start = COALESCE (os.date_estimated_start, os.date_estimated_end),
        date_estimated_end = NULL 
        WHERE os.date_estimated_type = 'no earlier than';

        -- exactly estimated
        UPDATE rcg_tms.order_stops os 
        SET date_estimated_start = COALESCE (os.date_estimated_start, os.date_estimated_end),
        date_estimated_end = COALESCE (os.date_estimated_start, os.date_estimated_end) 
        WHERE os.date_estimated_type = 'exactly';

        -- estimated estimated
        UPDATE rcg_tms.order_stops os 
        SET date_estimated_start = COALESCE (os.date_estimated_start, os.date_estimated_end),
        date_estimated_end = COALESCE (os.date_estimated_end, os.date_estimated_start) 
        WHERE os.date_estimated_type = 'estimated';
    `);
};

exports.down = function (knex)
{
    return knex.raw('select 1');
};
