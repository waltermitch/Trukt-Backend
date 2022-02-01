const SCHEMA_NAME = 'copart';
const TABLE_NAME = 'photos';
const INDEX_NAME = 'photos_lot_index';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, function (table)
    {
        table.index(['lot'], INDEX_NAME);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, function (table)
    {
        table.dropIndex(INDEX_NAME);
    });
};
