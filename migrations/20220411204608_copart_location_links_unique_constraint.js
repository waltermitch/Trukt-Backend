const SCHEMA_NAME = 'copart';
const TABLE_NAME = 'location_links';
const CONSTRAINT_NAME = 'location_links_unique_terminal_guid_and_yard_number';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, function (table)
    {
        table.unique(['terminal_guid', 'yard_number', 'sublot'], CONSTRAINT_NAME);
    });
};

exports.down = function (knex)
{
    return knex.raw(`ALTER TABLE ${SCHEMA_NAME}.${TABLE_NAME} DROP CONSTRAINT ${CONSTRAINT_NAME}`);
};
