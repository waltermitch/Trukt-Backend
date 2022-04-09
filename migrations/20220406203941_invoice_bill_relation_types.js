const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'invoice_bill_relation_types';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).createTable(TABLE_NAME, table =>
    {
        table.increments('id').primary().unique().notNullable();
        table.string('name').unique().notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).dropTable(TABLE_NAME, table =>
    {
        table.dropTableIfExists(TABLE_NAME);
    });
};
