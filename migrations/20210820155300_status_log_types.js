const TABLE_NAME = 'status_log_types';
const SCHEMA_NAME = 'rcg_tms';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).createTable(TABLE_NAME, (table) =>
    {
        table.integer('id').primary();
        table.string('category', 16).notNullable();
        table.string('name', 32).notNullable();
        table.string('order_filter_label', 32).default(null);
        table.unique(['category', 'name']);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).dropTableIfExists(TABLE_NAME);
};
