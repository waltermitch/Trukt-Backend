const schemaName = 'quickbooks';

exports.up = function (knex)
{
    return knex.raw(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
};

exports.down = function (knex)
{
    // drop schema with tables
    return knex.raw(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
};
