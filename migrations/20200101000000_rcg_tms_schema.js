const migration_tools = require('../tools/migration');

const schema_name = 'rcg_tms';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE SCHEMA IF NOT EXISTS ${schema_name}
    AUTHORIZATION ${migration_tools.db_owner};

    COMMENT ON SCHEMA ${schema_name}
        IS 'Stores all of the tables and data related to transportation management system.';
    `);
};

exports.down = function (knex)
{
    // do nothing because this schema has all the locks and what not for migration
};
