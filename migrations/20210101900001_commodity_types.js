const commodity_type_records = [
    { type: 'vehicle', subtype: 'coupe' },
    { type: 'vehicle', subtype: 'convertible' },
    { type: 'vehicle', subtype: 'sedan' },
    { type: 'vehicle', subtype: 'SUV' },
    { type: 'vehicle', subtype: 'minivan' },
    { type: 'vehicle', subtype: 'pickup truck(2 door)' },
    { type: 'vehicle', subtype: 'pickup truck(4 door)' },
    { type: 'vehicle', subtype: 'pickup dually' },
    { type: 'vehicle', subtype: 'motorcycle' },
    { type: 'vehicle', subtype: 'ATV' },
    { type: 'vehicle', subtype: 'boat' },
    { type: 'vehicle', subtype: 'RV' },
    { type: 'vehicle', subtype: 'trailer(5th wheel)' },
    { type: 'vehicle', subtype: 'trailer(bumper pull)' },
    { type: 'vehicle', subtype: 'trailer(gooseneck)' },
    { type: 'vehicle', subtype: 'cargo van' },
    { type: 'vehicle', subtype: 'box truck' },
    { type: 'vehicle', subtype: 'day cab' },
    { type: 'vehicle', subtype: 'sleeper cab' },
    { type: 'vehicle', subtype: 'other' },
    { type: 'freight', subtype: 'bulk' },
    { type: 'freight', subtype: 'crushed cars' },
    { type: 'freight', subtype: 'other' }
];

const table_name = 'commodity_types';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.increments('id', { primaryKey: true }).notNullable();
        table.enu('type', [ 'vehicle', 'freight' ]).notNullable().index();
        table.string('subtype', 32);
        table.unique([ 'type', 'subtype' ]);
    }).then((result) =>
    {
        knex(table_name).insert(commodity_type_records);

    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
