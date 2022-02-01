const SCHEMA_NAME = 'copart';
const TABLE_NAME = 'photos';
const INDEX_NAME = 'lot_index';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(TABLE_NAME, function (table)
    {
        table.index(['lot'], `${TABLE_NAME}_${INDEX_NAME}`);
    });
};

exports.down = function (knex)
{
    return knex.raw(`DROP INDEX IF EXISTS ${SCHEMA_NAME}.${TABLE_NAME}_${INDEX_NAME}`);
};
