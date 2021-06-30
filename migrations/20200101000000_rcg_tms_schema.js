const schema_name = 'rcg_tms';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE SCHEMA IF NOT EXISTS ${schema_name};

    COMMENT ON SCHEMA ${schema_name}
        IS 'Stores all of the tables and data related to transportation management system.';
    `);
};
/* eslint-disable-next-line no-unused-vars */
exports.down = function (knex)
{
    // do nothing because this schema has all the locks and what not for migration
};