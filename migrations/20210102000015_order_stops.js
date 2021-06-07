const migration_tools = require('../tools/migration');

const guid_function = migration_tools.guid_function;
const table_name = 'order_stops';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').unique().notNullable();
        table.integer('terminal').unsigned();
        table.enu('stop_type', [ 'pickup', 'delivery' ]);
        table.uuid('location').notNullable();
        table.foreign('location').references('guid').inTable('rcg_tms.terminals');
        for (const type of [ 'primary', 'alternative' ])
        {
            table.uuid(`${type}_contact`);
            table.foreign(`${type}_contact`).references('guid').inTable('rcg_tms.contacts');
        }

        for (const type of [ 'customer', 'vender' ])
        {

            table.datetime(`date_scheduled_start_${type}`);
            table.datetime(`date_scheduled_end_${type}`);
            table.enu(`${type}_date_type`, [
                'estimated',
                'excatly',
                'no later than',
                'no earlier than'
            ]);
        }

        table.datetime('date_started').comment('this is the date the order stop was started, enroute etc.');
        table.datetime('date_completed').comment('this is the date the order stop was completed, picked up, delivered etc.');
        table.integer('sequence').comment('describes the order the stops need to be visited in');

        table.string('status', 24).comment('do not modify this status field, it is purely for displaying to users');
        migration_tools.timestamps(knex, table);

    }).raw(guid_function(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
