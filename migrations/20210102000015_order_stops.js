const migration_tools = require('../tools/migration');

const TABLE_NAME = 'order_stops';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.uuid('guid').unique().notNullable();
        table.enu('stop_type', ['pickup', 'delivery'],
            { useNative: true, enumName: 'stop_types' });
        const terminalguid = 'terminal_guid';
        table.uuid(terminalguid).notNullable();
        table.foreign(terminalguid).references('guid').inTable('rcg_tms.terminals');
        for (const type of ['primary', 'alternative'])
        {
            const fieldname = `${type}_contact_guid`;
            table.uuid(fieldname);
            table.foreign(fieldname).references('guid').inTable('rcg_tms.terminal_contacts');
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
        .raw(migration_tools.guid_function(TABLE_NAME))
        .raw(migration_tools.timestamps_trigger(TABLE_NAME))
        .raw(migration_tools.authors_trigger(TABLE_NAME));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(TABLE_NAME)
        .raw('DROP TYPE IF EXISTS rcg_tms.date_schedule_types CASCADE;')
        .raw('DROP TYPE IF EXISTS rcg_tms.stop_types CASCADE;');
};
