
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table('orders', table =>
        {
            table.dropForeign('dispatcher_guid');
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table('orders', table =>
        {
            table.foreign('dispatcher_guid').references('guid').inTable('rcg_tms.tms_users');
        });
};
