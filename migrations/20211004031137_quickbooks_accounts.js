const schemaName = 'quickbooks';
const accountsTable = 'accounts';
const mappings = 'account_mappings';

exports.up = function (knex)
{

    return knex.schema.withSchema(schemaName)
        .createTable(accountsTable, (table) =>
        {
            table.increments('id', { primaryKey: true }).notNullable();
            table.string('name').notNullable();
            table.integer('billing_id').notNullable();
            table.integer('invoicing_id').notNullable();
        })
        .createTable(mappings, (table) =>
        {
            table.integer('account_id').notNullable();
            table.integer('item_id').unique().notNullable();

            table.foreign('account_id').references('id').inTable(`${schemaName}.${accountsTable}`);
            table.foreign('item_id').references('id').inTable('rcg_tms.invoice_bill_line_items');

            table.primary(['item_id', 'account_id']);
        });
};

exports.down = function (knex)
{
    // drop schema with tables
    return knex.schema.withSchema(schemaName)
        .dropTableIfExists(mappings)
        .dropTableIfExists(accountsTable);
};
