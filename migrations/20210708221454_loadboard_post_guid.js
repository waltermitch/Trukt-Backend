const migration_tools = require('../tools/migration');

const guid_function = migration_tools.guid_function;
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
            table.uuid('guid').unique().notNullable().primary().alter();
            table.text('api_error').comment('error that is returned from the loadboard api').alter();
        }).raw(guid_function(table_name));
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
        }).raw('DROP TRIGGER rcg_loadboard_posts_guid ON rcg_tms.loadboard_posts');
    });
};
