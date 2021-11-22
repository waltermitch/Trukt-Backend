const TABLE_NAME = 'vehicles';

exports.up = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.integer('weight_class_id');
        table.foreign('weight_class_id').references('id').inTable('vehicle_weight_classes');
    });
};

exports.down = function (knex)
{
    return knex.schema.table(TABLE_NAME, function (table)
    {
        table.dropForeign('weight_class_id');
        table.dropColumn('weight_class_id');
    });
};
