const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'terminals';
const COLLUMN_NAME = 'resolved_times';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .alterTable(TABLE_NAME, table =>
        {
            table.integer(COLLUMN_NAME).notNullable().defaultsTo(0);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME, table =>
        {
            table.dropColumn(COLLUMN_NAME);
        });
};
