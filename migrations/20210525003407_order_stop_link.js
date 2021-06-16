const migration_tools = require('../tools/migration');

const table_name = 'order_stop_links';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true }).notNullable();
        table.uuid('commodity').notNullable();
        table.foreign('commodity').references('guid').inTable('rcg_tms.commodities');
        table.uuid('order').notNullable();
        table.foreign('order').references('guid').inTable('rcg_tms.orders');
        table.uuid('job').notNullable();
        table.foreign('job').references('guid').inTable('rcg_tms.order_jobs');
        table.uuid('stop').notNullable();
        table.foreign('stop').references('guid').inTable('rcg_tms.order_stops');
        table.string('lot_number', 32).comment('Location for the commodity at this stop');
        table.datetime('date_completed').comment('the date this commodity was pickedup/delivered');

        table.boolean('is_completed').notNullable().defaultTo(false);

        table.unique([
            'order',
            'job',
            'stop',
            'commodity'
        ]);
        migration_tools.timestamps(knex, table);
    }).raw(migration_tools.timestamps_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
