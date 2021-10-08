const migration_tools = require('../tools/migration');

const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'edi_data';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).createTable(TABLE_NAME, (table) =>
    {
        table.uuid('guid').unique().notNullable();
        table.string('document_number', 10).comment('The EDI document number, i.e. 204, 214');
        table.uuid('order_guid').comment('The order that this EDI data belongs to.');
        table.foreign('order_guid').references('guid').inTable('rcg_tms.orders');
        table.json('data').comment('The EDI data in json format after being parsed.');
    })
        .raw(migration_tools.guid_function(TABLE_NAME));
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).dropTableIfExists(TABLE_NAME);
};
