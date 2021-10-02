const migration_tools = require('../tools/migration');

const TABLE_NAME = 'order_stop_links';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.increments('id', { primaryKey: true }).notNullable();
        const commodityfn = 'commodity_guid';
        const jobfn = 'job_guid';
        const stopfn = 'stop_guid';
        const orderfn = 'order_guid';
        table.uuid(commodityfn).notNullable();
        table.foreign(commodityfn).references('guid').inTable('rcg_tms.commodities');
        table.uuid(orderfn);
        table.foreign(orderfn).references('guid').inTable('rcg_tms.orders');
        table.uuid(jobfn);
        table.foreign(jobfn).references('guid').inTable('rcg_tms.order_jobs');
        table.uuid(stopfn).notNullable();
        table.foreign(stopfn).references('guid').inTable('rcg_tms.order_stops');
        table.string('lot_number', 32).comment('Location for the commodity at this stop');
        table.datetime('date_completed').comment('the date this commodity was pickedup/delivered');

        table.boolean('is_completed').notNullable().defaultTo(false);

        table.unique([
            orderfn,
            jobfn,
            stopfn,
            commodityfn
        ]);
        migration_tools.timestamps(table);
        migration_tools.authors(table);
    })
        .raw(migration_tools.timestamps_trigger(TABLE_NAME))
        .raw(migration_tools.authors_trigger(TABLE_NAME));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(TABLE_NAME);
};
