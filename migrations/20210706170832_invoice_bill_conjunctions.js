
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable('invoices', (table) =>
    {
        table.uuid('invoice_guid').unique().notNullable();
        table.uuid('order_guid').notNullable();

        table.foreign('invoice_guid').references('guid').inTable('invoice_bills');
        table.foreign('order_guid').references('guid').inTable('orders');

        table.primary(['order_guid', 'invoice_guid']);

    }).createTable('bills', (table) =>
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
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists('invoices')
        .dropTableIfExists('bills');
};
