const TABLE_NAME = 'commodity_types';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.increments('id', { primaryKey: true }).notNullable();
        table.string('category', 16).notNullable().index();
        table.string('type', 32);
        table.unique(['category', 'type']);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(TABLE_NAME);
};
