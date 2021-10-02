const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME_INVOICES = 'invoices';
const TABLE_NAME_BILLS = 'bills';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).createTable(TABLE_NAME_INVOICES, (table) =>
    {
        table.uuid('invoice_guid').unique().notNullable();
        table.uuid('order_guid').notNullable();

        table.foreign('invoice_guid').references('guid').inTable('invoice_bills');
        table.foreign('order_guid').references('guid').inTable('orders');

        table.primary(['order_guid', 'invoice_guid']);

    }).createTable(TABLE_NAME_BILLS, (table) =>
    {
        table.uuid('bill_guid').unique().notNullable();
        table.uuid('job_guid').notNullable();

        table.foreign('bill_guid').references('guid').inTable('invoice_bills');
        table.foreign('job_guid').references('guid').inTable('order_jobs');

        table.primary(['job_guid', 'bill_guid']);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .dropTableIfExists(TABLE_NAME_INVOICES)
        .dropTableIfExists(TABLE_NAME_BILLS);
};
