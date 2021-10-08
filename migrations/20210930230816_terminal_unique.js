const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'terminals';

/**
 * Right now this is causing issues for UpdateOrder and CreateOrder, it is going to be disable
 * until STS-1428 is resolve and fix the issue of checking references for terminals with same lat and lon
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
