const migration_tools = require('../tools/migration');

const table_name = 'order_job_types';
const related_table_name = 'order_jobs';

const job_type_records = [
    {
        type: 'transport', subtype: 'transport'
    },
    {
        type: 'service', subtype: 'locksmith'
    },
    {
        type: 'service', subtype: 'unloading'
    },
    {
        type: 'service', subtype: 'loading'
    },
    {
        type: 'service', subtype: 'repair'
    },
    {
        type: 'service', subtype: 'diagnostics'
    },
    {
        type: 'service', subtype: 'dry run'
    }
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true });
        table.enu('type', ['service', 'transport']).notNullable().index();
        table.string('subtype', 24).notNullable();
        table.unique(['type', 'subtype']);
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').table(related_table_name, (table) =>
        {
            table.integer('type').unsigned().notNullable();
            table.foreign('type').references('id').inTable(`rcg_tms.${table_name}`);

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
        table.dropForeign('type');
    }).then(() =>
    {
        return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);

    });
};
