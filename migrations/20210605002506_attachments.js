const documentTypes = require('../src/Schemas/attachmentTypes.json').enum;

const table_name = 'attachments';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary().notNullable().unique();
        table.enu('type', documentTypes, { useNative: true, enumName: 'document_types' }).notNullable();
        table.string('url').notNullable();
        table.string('extension');
        table.string('name').notNullable();
        table.uuid('parent').notNullable();
        table.string('parent_table').notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .dropTableIfExists(table_name)
        .raw('DROP TYPE IF EXISTS rcg_tms.document_types;');
};
