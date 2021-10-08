const migration_tools = require('../tools/migration');

const TABLE_NAME = 'terminals';
const TABLE_NAME_CONTACT = 'terminal_contacts';
const UNIQUE_CONTACT_FIELDS = [
    'terminal_guid',
    'first_name',
    'last_name',
    'phone_number'
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable(TABLE_NAME_CONTACT, (table) =>
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
        .raw(migration_tools.guid_function(TABLE_NAME_CONTACT))
        .raw(migration_tools.timestamps_trigger(TABLE_NAME_CONTACT))
        .raw(migration_tools.authors_trigger(TABLE_NAME_CONTACT))
        .createTable(TABLE_NAME, (table) =>
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
                table.foreign(fieldname).references('guid').inTable(`rcg_tms.${TABLE_NAME_CONTACT}`);
            }
            table.boolean('is_resolved').notNullable().defaultsTo(false).comment('this is set to true only and only when the address is verified and proper geo-coords are stored');
            migration_tools.timestamps(table);
            migration_tools.authors(table);

            table.unique(['latitude', 'longitude']);

        })
        .raw(migration_tools.guid_function(TABLE_NAME))
        .raw(migration_tools.timestamps_trigger(TABLE_NAME))
        .raw(migration_tools.authors_trigger(TABLE_NAME))

        .table(TABLE_NAME_CONTACT, (table) =>
        {
            table.uuid('terminal_guid').notNullable().comment('the terminal the contact is a contact for');
            table.foreign('terminal_guid').references('guid').inTable('rcg_tms.terminals');
            table.unique(UNIQUE_CONTACT_FIELDS);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(TABLE_NAME_CONTACT, (table) =>
        {
            table.dropUnique(UNIQUE_CONTACT_FIELDS);
            table.dropForeign('terminal_guid');

        })
        .dropTableIfExists(TABLE_NAME)
        .dropTableIfExists(TABLE_NAME_CONTACT)
        .raw('DROP TYPE IF EXISTS rcg_tms.location_types');
};
