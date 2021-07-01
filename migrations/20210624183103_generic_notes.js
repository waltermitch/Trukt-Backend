const migration_tools = require('../tools/migration');

const table_name = 'generic_notes';
const order_notes_table = 'order_notes';
const order_job_notes_table = 'order_job_notes';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable(table_name, (table) =>
        {
            table.uuid('guid').notNullable().unique();
            table.primary('guid');
            table.string('title', 100);
            table.text('body');
            table.boolean('is_broadcast').defaultTo(false);
            table.enu('type', ['lead', 'flag', 'update'], {
                useNative: true, enumName: 'note_types'
            }).notNullable();
            migration_tools.timestamps(knex, table);

        })
        .raw(migration_tools.guid_function(table_name))
        .raw(migration_tools.timestamps_trigger(table_name))
        .createTable(order_notes_table, (table) =>
        {
            const primaryKey = ['order_guid', 'note_guid'];
            table.uuid('order_guid').notNullable();
            table.foreign('order_guid').references('guid').inTable('rcg_tms.orders');
            table.uuid('note_guid').notNullable().unique();
            table.foreign('note_guid').references('guid').inTable(table_name).onDelete('CASCADE');
            table.primary(primaryKey);
            table.unique(primaryKey);
        })
        .createTable(order_job_notes_table, (table) =>
        {
            const primaryKey = ['job_guid', 'note_guid'];
            table.uuid('job_guid').notNullable();
            table.foreign('job_guid').references('guid').inTable('rcg_tms.order_jobs');
            table.uuid('note_guid').notNullable().unique();
            table.foreign('note_guid').references('guid').inTable(table_name).onDelete('CASCADE');
            table.primary(primaryKey);
            table.unique(primaryKey);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(order_job_notes_table)
        .dropTableIfExists(order_notes_table)
        .dropTableIfExists(table_name)
        .raw('DROP TYPE IF EXISTS rcg_tms.note_types;');
};
