const migration_tools = require('../tools/migration');

const table_name = 'invoice_bills';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary().notNullable().unique();
        table.string('reference_number', 64).comment('reference number for this invoice as used by our internal systems');
        const expartyfn = 'external_party_guid';
        table.string(expartyfn, 100).comment('this is the salesforce account vendor or client guid');
        table.foreign(expartyfn).references('guid__c').inTable('salesforce.account');

        table.string('external_source', 32).comment('the external accounting software source name. i.e. quickbooks online');
        table.string('external_source_guid', 64).comment('the external accounting software\'s invoice guid');
        table.json('external_source_data').comment('store anything in here that is from the external accounting software');
        table.boolean('is_synced_external_source').notNullable().defaultTo(false);
        table.datetime('date_synced_external_source').comment('the datetime that this invoice was generated or sent to the external accounting software');

        table.datetime('date_filed');
        table.datetime('date_due');
        table.datetime('date_paid');
        table.datetime('date_invoiced');
        table.datetime('date_closed');

        table.decimal('total', 15, 2).comment('This is calculated, please do not modify manually');

        table.string('payment_method');
        table.string('payment_terms');

        table.boolean('is_valid').notNullable().defaultTo(false).comment('the invoice or bill is valid when this is set, by default invalid, when user "generates" then sets it to valid');
        table.boolean('is_generated').notNullable().defaultTo(false).comment('This is set to true when a user generates the invoice or bill in the system');
        table.boolean('is_paid').notNullable().defaultTo(false);
        table.boolean('is_invoice').notNullable().comment('true value is invoice, false value is bill');
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
