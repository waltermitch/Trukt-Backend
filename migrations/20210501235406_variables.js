const table_name = 'variables';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.string('name').collate('pg_catalog."default"').notNullable().unique();
        table.json('data').notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTable(table_name);
};
