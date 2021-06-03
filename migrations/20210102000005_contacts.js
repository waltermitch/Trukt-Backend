const migration_tools = require('../tools/migration');

const guid_function = migration_tools.guid_function;
const table_name = 'contacts';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').unique();
        table.string('first_name', 24);
        table.string('last_name', 24);

        // In the United States and other countries participating in NANP, the maximum length of a phone number is 10 digits.
        // Internationally, phone lengths vary, but the ITU E.164 states that phone numbers around the globe are recommended to not be longer than 15 digits.
        table.string('phone_number', 15);
        table.string('modile_number', 15);
        table.string('email');

    }).raw(guid_function(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
