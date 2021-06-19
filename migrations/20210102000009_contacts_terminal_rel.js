const table_name = 'contacts';
const unique_contact_fields = [
    'terminal_guid',
    'first_name',
    'last_name',
    'phone_number'
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').table(table_name, (table) =>
    {
        table.uuid('terminal_guid').comment('the terminal the contact is a contact for');
        table.foreign('terminal_guid').references('guid').inTable('rcg_tms.terminals');
        table.unique(unique_contact_fields);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').table(table_name, (table) =>
    {
        table.dropUnique(unique_contact_fields);
        table.dropColumn('terminal_guid');
    });
};
