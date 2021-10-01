const TABLE_NAME = 'attachments';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE TYPE document_visibility AS ENUM ('internal', 'carrier', 'client');
    ALTER TABLE ${TABLE_NAME}
    ADD visibility document_visibility[] DEFAULT array['internal']::document_visibility[]`);
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .table(TABLE_NAME, (table) =>
        {
            table.dropColumn('visibility');
        })
        .raw('DROP TYPE IF EXISTS rcg_tms.document_visibility');
};
