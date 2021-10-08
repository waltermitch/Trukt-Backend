const tableName = 'invoice_bill_lines';

exports.up = function (knex)
{
    // alter table to add is_paid column
    return knex.schema.withSchema('rcg_tms')
        .alterTable(tableName, (table) =>
        {
            table.boolean('is_paid').defaultTo(false);
        });
};

exports.down = function (knex)
{
    // alter table to remove is_paid column
    return knex.schema.withSchema('rcg_tms')
        .alterTable(tableName, (table) =>
        {
            table.dropColumn('is_paid');
        });
};
