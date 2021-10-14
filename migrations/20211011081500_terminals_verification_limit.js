const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'terminals';
const COLLUMN_NAME = 'resolved_times';

/**
 * To avoid checking addresses that do not exist or may not be verify, we add a limit
 * on how many times we should keep verifying them with arcgis
 */
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
