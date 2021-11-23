const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'terminals';

/**
 * Unique coordintaes addes back again for STS-1428
 */

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, (table) =>
    {
        table.unique(['latitude', 'longitude']);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, (table) =>
    {
        table.dropUnique(['latitude', 'longitude']);
    });
};
