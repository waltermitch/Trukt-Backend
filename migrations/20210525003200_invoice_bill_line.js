const migration_tools = require('../tools/migration');

const table_name = 'invoice_bill_lines';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').unique().notNullable().primary();
        const invoiceguid = 'invoice_guid';
        table.uuid(invoiceguid).notNullable();
        table.foreign(invoiceguid).references('guid').inTable('rcg_tms.invoice_bills');
        table.decimal('amount', 15, 2).notNullable();
        migration_tools.timestamps(table);
        migration_tools.authors(table);

    })
        .raw(migration_tools.guid_function(table_name))
        .raw(migration_tools.timestamps_trigger(table_name))
        .raw(migration_tools.authors_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
