const migration_tools = require('../tools/migration');

const table_name = 'order_job_dispatches';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary();
        table.uuid('job_guid').notNullable();
        table.uuid('loadboard_post_guid');

        // carrier information
        table.string('vendor_guid', 100).notNullable().comment('The account completing the job for the company, usually a carrier account');
        table.foreign('vendor_guid').references('guid__c').inTable('salesforce.account');
        table.string('vendor_contact_guid', 100).comment('The vendor\'s primary contact');
        table.foreign('vendor_contact_guid').references('guid__c').inTable('salesforce.contact');
        table.string('vendor_agent_guid', 100).comment('The vendor\'s agent that will be doing the job, usually a driver or another worker');
        table.foreign('vendor_agent_guid').references('guid__c').inTable('salesforce.contact');

        table.string('external_guid', 100).comment('The external guid from the dispatch action returned from loadboards');
        table.boolean('is_pending').comment('Indicates if the dispatch was sent out and is waiting to be accepted or declined by the carrier or dispatcher');
        table.boolean('is_accepted');
        table.boolean('is_canceled');

        // financial information
        table.integer('payment_term_id').comment('The payment term id selected at the time of dispatching');
        table.integer('payment_method_id').comment('The payment method id selected at the time of dispatching');
        table.decimal('price', 15, 2).unsigned().comment('The price the job was dispatched for');
        table.foreign('payment_term_id').references('id').inTable('rcg_tms.invoice_bill_payment_terms');
        table.foreign('payment_method_id').references('id').inTable('rcg_tms.invoice_bill_payment_methods');

        table.foreign('loadboard_post_guid').references('guid').inTable('rcg_tms.loadboard_posts');
        migration_tools.timestamps(table);
        migration_tools.authors(table);
    }).raw(migration_tools.guid_function(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
