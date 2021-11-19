const TABLE_NAME = 'vehicle_weight_classes';

exports.up = function (knex)
{
    return knex.schema.createTable(TABLE_NAME, function (table)
    {
        table.increments('id').primary();
        table.string('class');
        table.integer('min_weight').notNullable();
        table.integer('max_weight').notNullable();
    });
};

exports.down = function (knex)
{
    return knex.schema.dropTable(TABLE_NAME);
};
