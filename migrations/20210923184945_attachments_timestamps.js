const migration_tools = require('../tools/migration');

const table_name = 'attachments';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(table_name, (table) =>
        {
            migration_tools.timestamps(table);
            migration_tools.authors(table);
        })
        .raw(migration_tools.timestamps_trigger(table_name))
        .raw(migration_tools.authors_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(table_name, (table) =>
        {
            table.dropForeign('created_by_guid');
            table.dropForeign('updated_by_guid');
            table.dropForeign('deleted_by_guid');

            table.dropColumn('created_by_guid');
            table.dropColumn('updated_by_guid');
            table.dropColumn('deleted_by_guid');

            table.dropColumn('date_created');
            table.dropColumn('date_updated');
            table.dropColumn('date_deleted');
            table.dropColumn('is_deleted');
        })
        .raw('DROP TRIGGER IF EXISTS rcg_attachments_crud_timestamps ON rcg_tms.attachments')
        .raw('DROP TRIGGER IF EXISTS rcg_attachments_crud_authors ON rcg_tms.attachments');
};
