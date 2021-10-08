const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'terminal_contacts';
const UNIQUE_CONTACT_FIELDS = ['terminal_guid', 'name', 'phone_number'];
const UNIQUE_CONTACT_FIELDS_OLD = [
    'terminal_guid',
    'first_name',
    'last_name',
    'phone_number'
];

exports.up = function (knex)
{

    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.string('name', 64);
            table.unique(UNIQUE_CONTACT_FIELDS);
        })
        .raw(`
            UPDATE rcg_tms.${TABLE_NAME}
            SET name = CONCAT( first_name, ' ' , last_name)
            WHERE name IS NULL;
        `)
        .table(TABLE_NAME, (table) =>
        {
            table.dropUnique(UNIQUE_CONTACT_FIELDS_OLD);
            table.dropColumn('first_name');
            table.dropColumn('last_name');
        });

};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.string('first_name', 24);
            table.string('last_name', 24);
            table.unique(UNIQUE_CONTACT_FIELDS_OLD);
        })
        .raw(`
            UPDATE rcg_tms.${TABLE_NAME}
            SET 
            first_name = SPLIT_PART( name, ' ', 1),
            last_name = SPLIT_PART(name, ' ', 2)
            WHERE name IS NULL;
        `)
        .table(TABLE_NAME, (table) =>
        {
            table.dropUnique(UNIQUE_CONTACT_FIELDS);
            table.dropColumn('name');
        });
};
