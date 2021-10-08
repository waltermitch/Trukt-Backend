const migration_tools = require('../tools/migration');

const TABLE_NAME_LB = 'loadboards';
const TABLE_NAME_LB_CONTACT = 'loadboard_contacts';
const TABLE_NAME_POST = 'loadboard_posts';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME_LB, (table) =>
    {
        table.string('name', 24).primary().notNullable();
        table.boolean('requires_options');
        table.boolean('allows_bulk');
        table.json('required_fields');
    }).createTable(TABLE_NAME_LB_CONTACT, (table) =>
    {
        table.increments().primary();
        table.string('loadboard', 20);
        table.string('name', 20).notNullable();
        table.string('phone', 20).notNullable();
        table.string('email', 50).notNullable();
        table.string('username', 50).notNullable();
        table.string('external_id', 80).comment('the external guid of the contact in the external loadboard system');
        table.foreign('loadboard').references('name').inTable(`rcg_tms.${TABLE_NAME_LB}`);
    }).createTable(TABLE_NAME_POST, (table) =>
    {
        table.increments().primary();
        table.uuid('job_guid').notNullable();
        table.string('loadboard').notNullable();
        table.string('external_guid', 80).comment('external id of the load');
        table.string('external_post_guid', 80).comment('external id of the posting');
        table.string('instructions', 60).comment('instructions for the posting, limited to 60 because of central dispatch');
        table.enu('status', [
            'fresh',
            'created',
            'posted',
            'updated',
            'reposted',
            'unposted',
            'removed'
        ], { useNative: true, enumName: 'post_status' }).defaultTo('fresh');
        table.boolean('is_created').defaultTo(false);
        table.boolean('is_posted').defaultTo(false);
        table.boolean('is_synced').defaultTo(false);
        table.boolean('has_error').defaultTo(false);
        table.string('api_error', 3000).comment('error that is returned from the loadboard api');
        table.json('values');

        migration_tools.timestamps(table);
        migration_tools.authors(table);

        table.foreign('job_guid').references('guid').inTable('rcg_tms.order_jobs');
        table.foreign('loadboard').references('name').inTable(`rcg_tms.${TABLE_NAME_LB}`);
    })
        .raw(migration_tools.timestamps_trigger(TABLE_NAME_POST))
        .raw(migration_tools.authors_trigger(TABLE_NAME_POST));

};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(TABLE_NAME_POST)
        .dropTableIfExists(TABLE_NAME_LB_CONTACT)
        .dropTableIfExists(TABLE_NAME_LB)
        .raw('DROP TYPE IF EXISTS rcg_tms.post_status');
};
