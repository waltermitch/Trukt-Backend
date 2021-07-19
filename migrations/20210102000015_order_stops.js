const migration_tools = require('../tools/migration');

const guid_function = migration_tools.guid_function;
const table_name = 'order_stops';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').unique().notNullable();
        table.enu('stop_type', ['pickup', 'delivery'],
            { useNative: true, enumName: 'stop_types' });
        const temrinalguid = 'terminal_guid';
        table.uuid(temrinalguid).notNullable();
        table.foreign(temrinalguid).references('guid').inTable('rcg_tms.terminals');
        for (const type of ['primary', 'alternative'])
        {
            const fieldname = `${type}_contact_guid`;
            table.uuid(fieldname);
            table.foreign(fieldname).references('guid').inTable('rcg_tms.contacts');
        }

        let exists = false;
        for (const type of ['customer', 'vendor'])
        {

            table.datetime(`date_scheduled_start_${type}`);
            table.datetime(`date_scheduled_end_${type}`);
            table.enu(`${type}_date_type`, [
                'estimated',
                'exactly',
                'no later than',
                'no earlier than'
            ], {
                useNative: true, enumName: 'date_schedule_types', existingType: exists
            });
            exists = true;
        }

        table.datetime('date_started').comment('this is the date the order stop was started, enroute etc.');
        table.datetime('date_completed').comment('this is the date the order stop was completed, picked up, delivered etc.');
        table.integer('sequence').comment('describes the order the stops need to be visited in');

        table.string('status', 24).comment('do not modify this status field, it is purely for displaying to users');
        migration_tools.timestamps(table);
        migration_tools.authors(table);

    })
        .raw(guid_function(table_name))
        .raw(migration_tools.timestamps_trigger(table_name))
        .raw(migration_tools.authors_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(table_name)
        .raw('DROP TYPE IF EXISTS rcg_tms.date_schedule_types CASCADE;')
        .raw('DROP TYPE IF EXISTS rcg_tms.stop_types CASCADE;');
};
