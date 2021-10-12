const orderTable = 'orders';
const jobTable = 'order_jobs';

exports.up = function(knex)
{
    return knex.schema.withSchema('rcg_tms').table(orderTable, (table) =>
    {
        table.decimal('gross_profit_margin', 5, 2);
    }).table(jobTable, (table) =>
    {
        table.decimal('gross_profit_margin', 5, 2);
    });
};

exports.down = function(knex)
{
    return knex.schema.withSchema('rcg_tms').table(orderTable, (table) =>
    {
        table.dropColumn('gross_profit_margin');
    }).table(jobTable, (table) =>
    {
        table.dropColumn('gross_profit_margin');
    });
};
