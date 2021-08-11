const table_name = 'terminal_contacts';
const unique_contact_fields = ['terminal_guid', 'name', 'phone_number'];
const unique_contact_fields_old = [
    'terminal_guid',
    'first_name',
    'last_name',
    'phone_number'
];

exports.up = function (knex)
{

    return knex.schema.withSchema('rcg_tms')
        .table(table_name, (table) =>
        {
            table.string('name', 64);
            table.unique(unique_contact_fields);
        })
        .raw(`
            UPDATE rcg_tms.${table_name}
            SET name = CONCAT( first_name, ' ' , last_name)
            WHERE name IS NULL;
        `)
        .table(table_name, (table) =>
        {
            table.dropUnique(unique_contact_fields_old);
            table.dropColumn('first_name');
            table.dropColumn('last_name');
        });

};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(table_name, (table) =>
        {
            table.string('first_name', 24);
            table.string('last_name', 24);
            table.unique(unique_contact_fields_old);
        })
        .raw(`
            UPDATE rcg_tms.${table_name}
            SET 
            first_name = SPLIT_PART( name, ' ', 1),
            last_name = SPLIT_PART(name, ' ', 2)
            WHERE name IS NULL;
        `)
        .table(table_name, (table) =>
        {
            table.dropUnique(unique_contact_fields);
            table.dropColumn('name');
        });
};
