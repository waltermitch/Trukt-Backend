
const SCHEMA_NAME = 'rcg_tms';
exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).raw(`
        CREATE OR REPLACE FUNCTION enum_type_select (text)
        RETURNS TABLE(enum_schema text, enum_name text, value text)
        AS $$
            SELECT 
                n.nspname as enum_schema,
                t.typname as enum_name, 
                e.enumlabel as value 
            FROM pg_type t 
            JOIN pg_enum e 
                ON t.oid = e.enumtypid 
            JOIN pg_catalog.pg_namespace n 
                ON n.oid = t.typnamespace 
            WHERE t.typname = $1;
        $$
        LANGUAGE SQL;
  `);
};

exports.down = function (knex)
{
    return knex.raw(`
        DROP FUNCTION enum_type_select (text);
    `);
};
