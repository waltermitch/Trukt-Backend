const table_name = 'loadboard_posts';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').table(table_name, (table) =>
    {
        table.uuid('guid');
    }).raw('update rcg_tms.loadboard_posts set guid = gen_random_uuid() where guid is null;').then(() =>
    {
        return knex.schema.withSchema('rcg_tms').alterTable(table_name, (table) =>
        {
            table.dropColumn('id');
            table.uuid('guid').notNullable().primary().alter();
            table.text('api_error').comment('error that is returned from the loadboard api').alter();
        });
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').table(table_name, (table) =>
    {
        table.dropColumn('guid');

    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').alterTable(table_name, (table) =>
        {
            table.increments('id', { primaryKey: true });
            table.string('api_error', 3000).comment('error that is returned from the loadboard api').alter();
        });
    });
};
