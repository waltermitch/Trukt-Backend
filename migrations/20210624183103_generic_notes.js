const migration_tools = require('../tools/migration');

const TABLE_NAME = 'generic_notes';
const ORDER_NOTES_TABLE = 'order_notes';
const ORDER_JOB_NOTES_TABLE = 'order_job_notes';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable(TABLE_NAME, (table) =>
        {
            table.uuid('guid').notNullable().unique();
            table.primary('guid');
            table.string('title', 100);
            table.text('body');
            table.boolean('is_broadcast').defaultTo(false);
            table.enu('type', ['lead', 'flag', 'update'], {
                useNative: true, enumName: 'note_types'
            }).notNullable();
            migration_tools.timestamps(table);
            migration_tools.authors(table);

        })
        .raw(migration_tools.guid_function(TABLE_NAME))
        .raw(migration_tools.timestamps_trigger(TABLE_NAME))
        .raw(migration_tools.authors_trigger(TABLE_NAME))
        .createTable(ORDER_NOTES_TABLE, (table) =>
        {
            const primaryKey = ['order_guid', 'note_guid'];
            table.uuid('order_guid').notNullable();
            table.foreign('order_guid').references('guid').inTable('rcg_tms.orders');
            table.uuid('note_guid').notNullable().unique();
            table.foreign('note_guid').references('guid').inTable(TABLE_NAME).onDelete('CASCADE');
            table.primary(primaryKey);
            table.unique(primaryKey);
        })
        .createTable(ORDER_JOB_NOTES_TABLE, (table) =>
        {
            const primaryKey = ['job_guid', 'note_guid'];
            table.uuid('job_guid').notNullable();
            table.foreign('job_guid').references('guid').inTable('rcg_tms.order_jobs');
            table.uuid('note_guid').notNullable().unique();
            table.foreign('note_guid').references('guid').inTable(TABLE_NAME).onDelete('CASCADE');
            table.primary(primaryKey);
            table.unique(primaryKey);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(ORDER_JOB_NOTES_TABLE)
        .dropTableIfExists(ORDER_NOTES_TABLE)
        .dropTableIfExists(TABLE_NAME)
        .raw('DROP TYPE IF EXISTS rcg_tms.note_types;');
};
