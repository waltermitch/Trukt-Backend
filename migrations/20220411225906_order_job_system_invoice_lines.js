const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'order_job_system_invoice_lines';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .createTable(TABLE_NAME, (table) =>
        {
            table.increments('id').primary();
            table.integer('job_type_id').notNullable();
            table.integer('line_item_id').notNullable();
            table.string('system_usage');
            table.foreign('job_type_id').references('id').inTable('rcg_tms.order_job_types');
            table.foreign('line_item_id').references('id').inTable('rcg_tms.invoice_bill_line_items');
            table.foreign('system_usage').references('type').inTable('rcg_tms.invoice_bill_lines_system_fields');
            table.unique(['job_type_id', 'line_item_id', 'system_usage']);
        }).raw(`
            -- Updates all invoices of transport jobs to use the new system_usage field
            UPDATE  rcg_tms.invoice_bill_lines 
            SET system_defined = TRUE,
            system_usage = 'base_pay'
            WHERE item_id = 1;

            -- Updates all invoices of transport jobs that have a referrer to use new system_usage field
            UPDATE  rcg_tms.invoice_bill_lines 
            SET system_defined = TRUE,
            system_usage = 'referrer'
            WHERE item_id = 7;
        `);
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).dropTableIfExists(TABLE_NAME);
};
