const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'orders';
exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, table =>
        {
            table.dropForeign('dispatcher_guid');
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, table =>
        {
            table.foreign('dispatcher_guid')
                .references('guid')
                .inTable('rcg_tms.tms_users');
        });
};
