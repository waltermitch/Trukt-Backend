const TABLE_NAME = 'order_stop_links';

exports.up = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.timestamp('date_started');
        table.boolean('is_started').defaultTo(false);
    });
};

exports.down = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.dropColumn('date_started');
        table.dropColumn('is_started');
    });
};