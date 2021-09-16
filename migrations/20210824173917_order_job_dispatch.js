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
        table.uuid('vendor_guid', 100).notNullable().comment('The account completing the job for the company, usually a carrier account');
        table.uuid('vendor_contact_guid', 100).comment('The vendor\'s primary contact');
        table.uuid('vendor_agent_guid', 100).comment('The vendor\'s agent that will be doing the job, usually a driver or another worker');

        table.string('external_guid', 100).comment('The external guid from the dispatch action returned from loadboards');
        table.string('is_pending').comment('Indicates if the dispatch was sent out but has not been accepted or canceled yet');

        // accepted information
        // table.boolean('is_accepted').comment('Indicates if the dispatch has been accepted and is now being fulfilled');
        // table.uuid('accepted_by').comment('Guid of the user that accepted the offer');
        // table.string('accepted_type').comment('Type of user that accepted the dispatch');
        // table.timestamp('date_accepted').comment('The datetime the dispatch was accepted');

        // financial information
        table.integer('payment_term_id').comment('The payment term id selected at the time of dispatching');
        table.integer('payment_method_id').comment('The payment method id selected at the time of dispatching');
        table.decimal('price', 15, 2).unsigned().comment('The price the job was dispatched for');
        table.foreign('payment_term_id').references('id').inTable('rcg_tms.invoice_bill_payment_terms');
        table.foreign('payment_method_id').references('id').inTable('rcg_tms.invoice_bill_payment_methods');

        // canceled information
        // table.boolean('is_canceled').comment('Indicates if dispatch was canceled');
        // table.uuid('canceled_by').comment('Guid of the user that canceled the dispatch');
        // table.string('canceled_type', 10).comment('Type of user that canceled the dispatch');
        // table.timestamp('date_canceled').comment('The datetime the dispatch was canceled on');

        table.foreign('loadboard_post_guid').references('guid').inTable('rcg_tms.loadboard_posts');
        migration_tools.timestamps(table);
        migration_tools.authors(table);
    }).raw(migration_tools.guid_function(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
