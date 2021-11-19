const SCHEMA_NAME = 'copart';

exports.up = function (knex)
{
    return knex.raw(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME}`);
};

exports.down = function (knex)
{
    return knex.raw(`DROP SCHEMA IF EXISTS ${SCHEMA_NAME} CASCADE`);
};
