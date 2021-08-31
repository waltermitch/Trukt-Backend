const table_name = 'attachments';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE TYPE document_visibility AS ENUM ('internal', 'carrier', 'client');
    ALTER TABLE ${table_name}
    ADD visibility document_visibility`);
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(table_name, (table) =>
        {
            table.dropColumn('visibility');
        })
        .raw('DROP TYPE IF EXISTS rcg_tms.document_visibility');
};
