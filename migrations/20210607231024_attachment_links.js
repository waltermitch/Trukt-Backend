const table_name = 'attachment_links';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('externalObjectId').notNullable();
        table.uuid('attachmentId').notNullable();
        table.foreign('attachmentId').references('guid').inTable('rcg_tms.attachments');
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTable(table_name);
};