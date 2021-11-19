const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'terminals';

/**
 * Removed temporarily and added back in 20211025152400_terminals_unique_coordinates.js
 */

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, (table) =>
    {
        table.dropUnique(['latitude', 'longitude']);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, (table) =>
    {
        table.unique(['latitude', 'longitude']);
    });
};
