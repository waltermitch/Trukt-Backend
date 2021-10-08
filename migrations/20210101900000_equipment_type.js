const TABLE_NAME = 'equipment_types';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms')
        .createTable(TABLE_NAME, (table) =>
        {
            table.increments('id', { primaryKey: true }).notNullable();
            table.string('name', 48).notNullable().unique();
            table.boolean('is_deprecated').defaultsTo(false).comment('checked when this is deleted but still needs to be used for the older records');
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(TABLE_NAME);
};
