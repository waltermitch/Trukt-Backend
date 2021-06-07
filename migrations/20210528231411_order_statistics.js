const migration_tools = require('../tools/migration');

const view_name = 'order_statistics';
exports.up = function (knex)
{
    return knex.raw(`
            CREATE OR REPLACE VIEW rcg_tms.${view_name} AS
                SELECT 
                    o.guid AS order,
                    CASE 
                        WHEN o.date_completed = NULL THEN o.date_completed::date - o.date_created::date
                        ELSE CURRENT_TIMESTAMP::date - o.date_created::date 
                    END AS age,
                    (SELECT COUNT(guid) > 0 FROM rcg_tms.order_stops stop LEFT JOIN rcg_tms.order_stop_links link ON link.order = o.guid AND stop.guid = link.stop WHERE stop.date_completed <> NULL AND CURRENT_TIMESTAMP > o.date_expected_complete_by AND link.order = o.guid) AS is_late
                FROM rcg_tms.orders o;

            ALTER TABLE rcg_tms.order_statistics OWNER TO ${migration_tools.db_owner}
        `);
};

exports.down = function (knex)
{
    return knex.raw(`DROP VIEW IF EXISTS ${view_name}`);
};
