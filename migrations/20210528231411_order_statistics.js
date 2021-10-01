const VIEW_NAME = 'order_statistics';
exports.up = function (knex)
{
    return knex.raw(`
        CREATE OR REPLACE VIEW rcg_tms.${VIEW_NAME} AS
        SELECT 
            o.guid AS order,
            CASE 
                WHEN o.date_completed = NULL THEN o.date_completed::date - o.date_created::date
                ELSE CURRENT_TIMESTAMP::date - o.date_created::date 
            END AS age,
            (   SELECT 
                    COUNT(guid) > 0 
                FROM 
                    rcg_tms.order_stops stop 
                LEFT JOIN 
                    rcg_tms.order_stop_links link 
                ON 
                    link.order_guid = o.guid 
                    AND stop.guid = link.stop_guid 
                WHERE 
                    stop.date_completed <> NULL 
                    AND CURRENT_TIMESTAMP > o.date_expected_complete_by 
                    AND link.order_guid = o.guid
            ) AS is_late
        FROM rcg_tms.orders o;
    `);
};

exports.down = function (knex)
{
    return knex.raw(`DROP VIEW IF EXISTS ${VIEW_NAME}`);
};
