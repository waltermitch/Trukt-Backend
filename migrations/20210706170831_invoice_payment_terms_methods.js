const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'invoice_bill_payment_terms';
const TABLE_NAME_PAYMENT_METHODS = 'invoice_bill_payment_methods';
const TABLE_NAME_INVOICE_BILLS = 'invoice_bills';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .createTable(TABLE_NAME, (table) =>
        {
            table.increments('id', { primaryKey: true });
            table.string('name', 24);
        })
        .createTable(TABLE_NAME_PAYMENT_METHODS, (table) =>
        {
            table.increments('id', { primaryKey: true });
            table.string('name', 24);
        }).then(() =>
        {
            return knex.schema.withSchema(SCHEMA_NAME)
                .alterTable(TABLE_NAME_INVOICE_BILLS, (table) =>
                {
                    table.integer('payment_method_id').unsigned();
                    table.integer('payment_term_id').unsigned();
                    table.foreign('payment_method_id').references('id').inTable(TABLE_NAME_PAYMENT_METHODS);
                    table.foreign('payment_term_id').references('id').inTable(TABLE_NAME);
                    table.dropColumn('payment_method');
                    table.dropColumn('payment_terms');
                });
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME_INVOICE_BILLS, (table) =>
        {
            table.dropForeign('payment_method_id');
            table.dropForeign('payment_term_id');
            table.dropColumn('payment_method_id');
            table.dropColumn('payment_term_id');
            table.string('payment_method');
            table.string('payment_terms');
        })
        .dropTableIfExists(TABLE_NAME)
        .dropTableIfExists(TABLE_NAME_PAYMENT_METHODS);

};
