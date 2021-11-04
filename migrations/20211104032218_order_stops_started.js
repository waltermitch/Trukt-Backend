const TABLE_NAME = 'order_stops';

exports.up = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.boolean('is_started').defaultTo(false);
        table.boolean('is_completed').defaultTo(false);
    });
};

exports.down = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.dropColumn('is_completed');
        table.dropColumn('is_started');
    });
};
