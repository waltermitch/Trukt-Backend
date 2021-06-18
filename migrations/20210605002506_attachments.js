const documentTypes = require('../Classes/Schemas/attachmentTypes.json').enum;

const table_name = 'attachments';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary().notNullable().unique();
        table.enu('type', documentTypes).defaultTo('undefined');
        table.string('url').notNullable();
        table.string('extension');
        table.string('name').notNullable();
        table.uuid('parent').notNullable();
        table.string('parent_table').notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTable(table_name);
};
