const migration_tools = require('../tools/migration');

const guid_function = migration_tools.guid_function;
const table_name = 'terminals';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.string('name').notNullable();
        table.uuid('guid').unique().notNullable().primary();
        table.enu('location_type', [
            'dealer',
            'private',
            'auction',
            'repo yard',
            'port',
            'business'
        ], {
            useNative: true, enumName: 'location_types'
        });

        table.string('street1', 64);
        table.string('street2', 64);

        // this will not be an enum because if we ship internationally want to include other countries states/provinces
        table.string('state', 100);
        table.string('city', 64);
        table.string('country', 64);
        table.string('zip_code', 16).notNullable();
        table.decimal('latitude', 15, 7);
        table.decimal('longitude', 15, 7);
        for (const type of ['primary', 'alternative'])
        {
            const fieldname = type + '_contact_guid';
            table.uuid(fieldname).comment('the default ' + type + ' contact for this terminal');
            table.foreign(fieldname).references('guid').inTable('rcg_tms.contacts');
        }
        table.boolean('is_resolved').notNullable().defaultsTo(false).comment('this is set to true only and only when the address is verified and proper geo-coords are stored');
        migration_tools.timestamps(knex, table);
        table.unique(['latitude', 'longitude']);

    }).raw(guid_function(table_name)).raw(migration_tools.timestamps_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(table_name)
        .raw('DROP TYPE IF EXISTS rcg_tms.location_types');
};