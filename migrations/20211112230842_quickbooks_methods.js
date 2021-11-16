const schemaName = 'quickbooks';
const methodsTable = 'payment_methods';
const mappings = 'payment_method_mappings';

exports.up = function (knex)
{

    return knex.schema.withSchema(schemaName)
        .createTable(methodsTable, (table) =>
        {
            table.integer('id', { primaryKey: true }).unique().notNullable();
            table.string('name').notNullable();
        })
        .createTable(mappings, (table) =>
        {
            table.integer('account_id').notNullable();
            table.integer('item_id').unique().notNullable();

            table.foreign('account_id').references('id').inTable(`${schemaName}.${methodsTable}`);
            table.foreign('item_id').references('id').inTable('rcg_tms.invoice_bill_line_items');

            table.primary(['item_id', 'account_id']);
        });
};

exports.down = function (knex)
{
    // drop schema with tables
    return knex.schema.withSchema(schemaName)
        .dropTableIfExists(methodsTable)
        .dropTableIfExists(mappings);
};
