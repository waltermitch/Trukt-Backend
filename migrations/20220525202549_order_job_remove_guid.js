const TABLE_NAME = 'order_job_cases';
const SCHEMA_NAME = 'rcg_tms';
const FUNCTION_NAME = 'rcg_gen_uuid';
exports.up = function(knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME, (table) =>
        {
        })
        .raw(`DROP TRIGGER IF EXISTS rcg_${TABLE_NAME}_guid ON rcg_tms.${TABLE_NAME};`);
};

exports.down = function(knex)
{
    return knex.schema.withSchema('rcg_tms')
    .dropTableIfExists(TABLE_NAME);
};
