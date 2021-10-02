const TABLE_NAME = 'order_job_types';
const RELATED_TABLE_NAME = 'order_jobs';

const typefn = 'type_id';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        table.increments('id', { primaryKey: true });
        table.string('category', 16).notNullable().index();
        table.string('type', 24).notNullable().index();
        table.unique(['category', 'type']);
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').table(RELATED_TABLE_NAME, (table) =>
        {
            table.integer(typefn).unsigned().notNullable();
            table.foreign(typefn).references('id').inTable(`rcg_tms.${TABLE_NAME}`);

        });

    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').table(RELATED_TABLE_NAME, (table) =>
    {
        table.dropForeign(typefn);
        table.dropColumn(typefn);
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').dropTableIfExists(TABLE_NAME);

    });
};
