const migration_tools = require('../tools/migration');

const table_name = 'invoice_bills';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary().notNullable().unique();
        table.string('external_party', 100).notNullable();
        table.foreign('external_party').references('guid__c').inTable('salesforce.account');
        table.uuid('order');
        table.foreign('order').references('guid').inTable('rcg_tms.orders');

        migration_tools.timestamps(knex, table);
        table.datetime('date_filed');
        table.datetime('date_due');
        table.datetime('date_paid');

        table.decimal('total', 15, 2).comment('This is calculated, please do not modify manually');

        table.string('payment_method');
        table.string('payment_terms');

        table.boolean('is_valid').notNullable().defaultTo(false).comment('the invoice or bill is valid when this is set, by default invalid, when user "generates" then sets it to valid');
        table.boolean('is_generated').notNullable().defaultTo(false).comment('This is set to true when a user generates the invoice or bill in the system');
        table.boolean('is_paid').notNullable().defaultTo(false);
        table.boolean('is_invoice').notNullable().comment('true value is invoice, false value is bill');

    }).raw(migration_tools.guid_function(table_name)).raw(migration_tools.timestamps_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
