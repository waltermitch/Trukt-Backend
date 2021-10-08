const migration_tools = require('../tools/migration');

const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'attachments';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            migration_tools.timestamps(table);
            migration_tools.authors(table);
        })
        .raw(migration_tools.timestamps_trigger(TABLE_NAME))
        .raw(migration_tools.authors_trigger(TABLE_NAME));
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
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
        .raw(`DROP TRIGGER IF EXISTS rcg_attachments_crud_timestamps ON ${SCHEMA_NAME}.${TABLE_NAME}`)
        .raw(`DROP TRIGGER IF EXISTS rcg_attachments_crud_authors ON ${SCHEMA_NAME}.${TABLE_NAME}`);
};
