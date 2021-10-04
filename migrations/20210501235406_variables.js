const TABLE_NAME = 'variables';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.string('name').collate('pg_catalog."default"').notNullable().unique();
        table.json('data').notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTable(TABLE_NAME);
};
