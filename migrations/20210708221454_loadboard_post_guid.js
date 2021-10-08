const migration_tools = require('../tools/migration');

const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'loadboard_posts';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, (table) =>
    {
        table.uuid('guid');
    }).raw('update rcg_tms.loadboard_posts set guid = gen_random_uuid() where guid is null;').then(() =>
    {
        return knex.schema.withSchema(SCHEMA_NAME).alterTable(TABLE_NAME, (table) =>
        {
            table.dropColumn('id');
            table.uuid('guid').unique().notNullable().primary().alter();
            table.text('api_error').comment('error that is returned from the loadboard api').alter();
        }).raw(migration_tools.guid_function(TABLE_NAME));
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, (table) =>
    {
        table.dropColumn('guid');

    }).then(() =>
    {
        return knex.schema.withSchema(SCHEMA_NAME).alterTable(TABLE_NAME, (table) =>
        {
            table.increments('id', { primaryKey: true });
            table.string('api_error', 3000).comment('error that is returned from the loadboard api').alter();
        }).raw('DROP TRIGGER IF EXISTS rcg_loadboard_posts_guid ON rcg_tms.loadboard_posts');
    });
};
