const migration_tools = require('../tools/migration');

const table_name = 'loadboard_requests';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary();
        table.string('status', 16).notNullable();
        table.decimal('price', 8, 2).notNullable().comment('Price offered by carrier for job');
        table.string('external_post_guid', 48).comment('loadboards external GUID for identifying the request');
        table.string('loadboard', 24).comment('What loadboard the request is related to');
        table.uuid('loadboard_post_guid').comment('related trukt loadboard post');
        table.datetime('date_offer_sent').comment('date the offer was created by the carrier');
        table.datetime('date_pickup_start').comment('earliest date carrier can pick up load');
        table.datetime('date_pickup_end').comment('latest date the carrier can pick up load');
        table.datetime('date_delivery_start').comment('earliest date the carrier can deliver the load');
        table.datetime('date_delivery_end').comment('latest date the carrier can deliver the load');
        table.string('decline_reason', 1024).comment('reason the request has been denied');
        table.string('carrier_identifier', 32).comment('number identifying the carrier ie. MC, DOT');
        table.json('extra_external_data');
        table.boolean('is_active').notNullable().defaultTo(true);
        table.boolean('is_accepted').notNullable().defaultTo(false);
        table.boolean('is_declined').notNullable().defaultTo(false);
        table.boolean('is_canceled').notNullable().defaultTo(false);
        table.boolean('is_synced').notNullable().defaultTo(false);
        table.boolean('has_error').notNullable().defaultTo(false);
        table.text('external_error');

        table.foreign('loadboard_post_guid').references('guid').inTable('rcg_tms.loadboard_posts');
        migration_tools.timestamps(table);
        migration_tools.authors(table);
    })
        .raw(migration_tools.timestamps_trigger(table_name))
        .raw(migration_tools.authors_trigger(table_name))
        .raw(migration_tools.guid_function(table_name));

};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(table_name)
        .raw('DROP TYPE IF EXISTS rcg_tms.carrier_identifier_types CASCADE;');
};
