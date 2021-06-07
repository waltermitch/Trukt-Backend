
const table_name = 'vehicles';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true }).unique().notNullable();
        table.integer('year');
        table.string('make');
        table.string('model');
        table.string('trim');
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
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
