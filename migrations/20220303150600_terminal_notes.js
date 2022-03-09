const TABLE_NAME = 'terminals';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').alterTable(TABLE_NAME, table =>
    {
        table.text('notes').defaultsTo('');
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').alterTable(TABLE_NAME, table =>
    {
        table.dropColumn('notes');
    });
};
