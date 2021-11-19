const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'invoice_bill_lines';

/**
 * New transaction collumns TBE-90
 */

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME, table =>
        {
            table.timestamp('date_charged');
            table.string('transaction_number', 64);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.dropColumn('date_charged');
            table.dropColumn('transaction_number');
        });
};
