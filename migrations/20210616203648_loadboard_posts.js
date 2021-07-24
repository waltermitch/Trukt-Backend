const migration_tools = require('../tools/migration');

const loadboardNames = [
    { name: 'SUPERDISPATCH' },
    { name: 'CENTRALDISPATCH' },
    { name: 'SHIPCARS' },
    { name: 'DAT' },
    { name: 'TRUCKSTOP' },
    { name: 'CARDELIVERYNETWORK' },
    { name: 'AUTOIMS' }
];
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable('loadboards', (table) =>
    {
        table.string('name', 24).primary().notNullable();
    }).createTable('loadboard_posts', (table) =>
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
        table.boolean('is_created').defaultTo(true);
        table.boolean('is_posted').defaultTo(false);
        table.boolean('is_synced').defaultTo(false);
        table.json('values');
        migration_tools.timestamps(knex, table);
        table.foreign('job_guid').references('guid').inTable('rcg_tms.order_jobs');
        table.foreign('loadboard').references('name').inTable('rcg_tms.loadboards');
    }).then(() =>
    {
        return knex('loadboards').insert(loadboardNames);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists('loadboard_posts').dropTableIfExists('loadboards').raw('DROP TYPE IF EXISTS rcg_tms.post_status');
};
