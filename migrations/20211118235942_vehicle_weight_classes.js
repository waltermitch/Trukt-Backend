const TABLE_NAME = 'vehicle_weight_classes';

exports.up = function (knex)
{
    // constraint max_weight must be greater than or equal to min_weight
    return knex.schema.createTable(TABLE_NAME, function (table)
    {
        table.increments('id').primary();
        table.string('class');
        table.integer('min_weight').notNullable();
        table.integer('max_weight').notNullable();
    }).raw(`ALTER TABLE ${TABLE_NAME} ADD CONSTRAINT max_weight_greater_than_min_weight CHECK (max_weight >= min_weight)`);
};

exports.down = function (knex)
{
    return knex.schema.dropTable(TABLE_NAME);
};
