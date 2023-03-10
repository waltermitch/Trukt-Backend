const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'commodities';

/**
 * The purpose of this is to add a dynamic json field onto the commodities table
 * which will hold extra info on commodities that we should not storing directly in
 * our db, such as external guids from superdispatch and ship cars
 */
exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.json('extra_external_data');
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.dropColumn('extra_external_data');
        });
};
