const table_name = 'commodity_types';
const commodity_type_records = [
    { category: 'vehicle', type: 'coupe' },
    { category: 'vehicle', type: 'convertible' },
    { category: 'vehicle', type: 'sedan' },
    { category: 'vehicle', type: 'SUV' },
    { category: 'vehicle', type: 'minivan' },
    { category: 'vehicle', type: 'pickup truck (2 door)' },
    { category: 'vehicle', type: 'pickup truck (4 door)' },
    { category: 'vehicle', type: 'pickup dually' },
    { category: 'vehicle', type: 'motorcycle' },
    { category: 'vehicle', type: 'ATV' },
    { category: 'vehicle', type: 'boat' },
    { category: 'vehicle', type: 'RV' },
    { category: 'vehicle', type: 'trailer (5th wheel)' },
    { category: 'vehicle', type: 'trailer (bumper pull)' },
    { category: 'vehicle', type: 'trailer (gooseneck)' },
    { category: 'vehicle', type: 'cargo van' },
    { category: 'vehicle', type: 'box truck' },
    { category: 'vehicle', type: 'day cab' },
    { category: 'vehicle', type: 'sleeper cab' },
    { category: 'vehicle', type: 'other' },
    { category: 'freight', type: 'bulk' },
    { category: 'freight', type: 'crushed cars' },
    { category: 'freight', type: 'other' }
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true }).notNullable();
        table.string('category', 16).notNullable().index();
        table.string('type', 32);
        table.unique(['category', 'type']);
    }).then(() =>
    {
        return knex(table_name).insert(commodity_type_records);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
