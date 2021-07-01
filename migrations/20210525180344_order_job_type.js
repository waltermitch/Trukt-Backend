const table_name = 'order_job_types';
const related_table_name = 'order_jobs';

const job_type_records = [
    { category: 'transport', type: 'transport' },
    { category: 'service', type: 'locksmith' },
    { category: 'service', type: 'unloading' },
    { category: 'service', type: 'loading' },
    { category: 'service', type: 'repair' },
    { category: 'service', type: 'diagnostics' },
    { category: 'service', type: 'dry run' }
];

const typefn = 'type_id';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true });
        table.string('category', 16).notNullable().index();
        table.string('type', 24).notNullable().index();
        table.unique(['category', 'type']);
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').table(related_table_name, (table) =>
        {
            table.integer(typefn).unsigned().notNullable();
            table.foreign(typefn).references('id').inTable(`rcg_tms.${table_name}`);

        });

    }).then(() =>
    {
        return knex(`rcg_tms.${table_name}`).insert(job_type_records);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').table(related_table_name, (table) =>
    {
        table.dropForeign(typefn);
        table.dropColumn(typefn);
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);

    });
};
