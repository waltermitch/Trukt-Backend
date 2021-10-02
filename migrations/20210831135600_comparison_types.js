const TABLE_NAME = 'comparison_types';
const SCHEMA_NAME = 'rcg_tms';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).createTable(TABLE_NAME, (table) =>
    {
        table.string('label', 32).primary();
        table.string('value', 10).notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).dropTableIfExists(TABLE_NAME);
};
