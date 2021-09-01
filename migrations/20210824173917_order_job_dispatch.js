const migration_tools = require('../tools/migration');

const table_name = 'order_job_dispatches';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary();
        table.uuid('job_guid').notNullable();
        table.integer('loadboard_post_id');
        table.string('vendor_guid', 100).notNullable().comment('The account completing the job for the company, usually a carrier account');
        table.string('vendor_contact_guid', 100).comment('The vendor\'s primary contact');
        table.string('vendor_agent_guid', 100).comment('The vendor\'s agent that will be doing the job, usually a driver or another worker');
        table.string('external_guid', 100).comment('The external guid from the dispatch action returned from loadboards');
        table.boolean('is_active').comment('This field indicates if the dispatch has been accepted and is now being fulfilled');
        table.boolean('is_canceled').comment('This field indicates if dispatch was canceled ');
        table.integer('payment_term').comment('The payment term selected at the time of dispatching');
        table.integer('payment_method').comment('The payment method selected at the time of dispatching');
        table.decimal('price', 15, 2).unsigned().comment('The price the job was dispatched for');

        table.foreign('payment_term').references('id').inTable('rcg_tms.invoice_bill_payment_terms');
        table.foreign('payment_method').references('id').inTable('rcg_tms.invoice_bill_payment_methods');
        migration_tools.timestamps(table);
        migration_tools.authors(table);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
