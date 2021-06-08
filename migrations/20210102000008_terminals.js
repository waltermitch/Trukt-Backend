const migration_tools = require('../tools/migration');

const guid_function = migration_tools.guid_function;
const table_name = 'terminals';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.string('name').unique().notNullable();
        table.uuid('guid').unique();
        table.enu('location_type', [
            'dealer',
            'private',
            'auction',
            'repo yard',
            'port',
            'business'
        ]);
        table.string('street1');
        table.string('street2');

        // this will not be an enum because if we ship internationally want to include other countries states/provinces
        table.string('state');
        table.string('city');
        table.string('zip_code', 16).notNullable();
        table.decimal('latitude', 15, 7);
        table.decimal('longitude', 15, 7);
        for (const type of ['primary', 'alternative'])
        {
            const fieldname = type + '_contact';
            table.integer(fieldname).unsigned().comment('the default ' + type + ' contact for this terminal');
            table.foreign(fieldname).references('id').inTable('salesforce.contact');
        }
        table.binary('is_resolved').notNullable().defaultsTo(false).comment('this is set to true only and only when the address is verified and proper geo-coords are stored');
        migration_tools.timestamps(knex, table);

        table.index('guid');
        table.unique(['latitude', 'longitude']);

    }).raw(guid_function(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
