const TABLE_NAME = 'vehicles';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.increments('id', { primaryKey: true }).unique().notNullable();
        table.string('year', 4);
        table.string('make', 16);
        table.string('model', 16);
        table.string('trim', 5);
        table.unique([
            'year',
            'make',
            'model',
            'trim'
        ]);
        table.index('make');
        table.index('model');
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(TABLE_NAME);
};
