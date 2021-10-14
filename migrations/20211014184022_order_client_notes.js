const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'orders';

exports.up = function(knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, table =>
    {
        table.json('client_notes').comment('Notes shared with customer about the order');
    });
};

exports.down = function(knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, table =>
    {
        table.dropColumn('client_notes');
    });
};
