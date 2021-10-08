const migration_tools = require('../tools/migration');

const TABLE_NAME = 'invoice_bill_lines';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.uuid('guid').unique().notNullable().primary();
        table.string('notes', 1024).comment('Line Description');
        const invoiceguid = 'invoice_guid';
        table.uuid(invoiceguid).notNullable();
        table.foreign(invoiceguid).references('guid').inTable('rcg_tms.invoice_bills');
        table.decimal('amount', 15, 2).notNullable();
        table.integer('item_id').unsigned().notNullable();
        table.foreign('item_id').references('id').inTable('rcg_tms.invoice_bill_line_items');
        const commodityguid = 'commodity_guid';
        table.uuid(commodityguid);
        table.foreign(commodityguid).references('guid').inTable('rcg_tms.commodities');
        migration_tools.timestamps(table);
        migration_tools.authors(table);

    })
        .raw(migration_tools.guid_function(TABLE_NAME))
        .raw(migration_tools.timestamps_trigger(TABLE_NAME))
        .raw(migration_tools.authors_trigger(TABLE_NAME));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(TABLE_NAME);
};
