const migration_tools = require('../tools/migration');

const table_name = 'terminals';
const table_name_contact = 'terminal_contacts';
const unique_contact_fields = [
    'terminal_guid',
    'first_name',
    'last_name',
    'phone_number'
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable(table_name_contact, (table) =>
        {
            table.uuid('guid').unique().primary().notNullable();
            table.string('first_name', 24);
            table.string('last_name', 24);

            // In the United States and other countries participating in NANP, the maximum length of a phone number is 10 digits.
            // Internationally, phone lengths vary, but the ITU E.164 states that phone numbers around the globe are recommended to not be longer than 15 digits.
            table.string('phone_number', 32);
            table.string('mobile_number', 32);
            table.string('email');
            migration_tools.timestamps(table);
            migration_tools.authors(table);

        })
        .raw(migration_tools.guid_function(table_name_contact))
        .raw(migration_tools.timestamps_trigger(table_name_contact))
        .raw(migration_tools.authors_trigger(table_name_contact))
        .createTable(table_name, (table) =>
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
                table.foreign(fieldname).references('guid').inTable(`rcg_tms.${table_name_contact}`);
            }
            table.boolean('is_resolved').notNullable().defaultsTo(false).comment('this is set to true only and only when the address is verified and proper geo-coords are stored');
            migration_tools.timestamps(table);
            migration_tools.authors(table);

            table.unique(['latitude', 'longitude']);

        })
        .raw(migration_tools.guid_function(table_name))
        .raw(migration_tools.timestamps_trigger(table_name))
        .raw(migration_tools.authors_trigger(table_name))

        .table(table_name_contact, (table) =>
        {
            table.uuid('terminal_guid').notNullable().comment('the terminal the contact is a contact for');
            table.foreign('terminal_guid').references('guid').inTable('rcg_tms.terminals');
            table.unique(unique_contact_fields);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(table_name_contact, (table) =>
        {
            table.dropUnique(unique_contact_fields);
            table.dropForeign('terminal_guid');

        })
        .dropTableIfExists(table_name)
        .dropTableIfExists(table_name_contact)
        .raw('DROP TYPE IF EXISTS rcg_tms.location_types');
};
