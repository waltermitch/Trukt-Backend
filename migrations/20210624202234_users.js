const migration_tools = require('../tools/migration');
const table_name = 'tms_users';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable(table_name, (table) =>
        {
            table.uuid('guid').notNullable().unique().comment('this should only be set by external systems from where the user was generated');
            table.primary('guid');
            table.string('external_id').comment('use this field only if the users are not using a uuid in the external system');
            table.string('name', 64);
            table.string('source', 16).comment('the location this user came from. i.e. salesforce, azure, etc');
            table.timestamp('date_created').notNullable().defaultsTo(knex.fn.now());
            table.timestamp('date_updated');
        }).raw(migration_tools.timestamps_trigger(table_name))
};

exports.down = function (knex)
{
    return knex.schema.dropTableIfExists(table_name);
};
