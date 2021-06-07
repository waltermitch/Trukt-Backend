const table_name = 'vehicle_types';
const vehicle_type_records = [
    { name: 'Coupe' },
    { name: 'Convertible' },
    { name: 'Sedan' },
    { name: 'SUV' },
    { name: 'Minivan' },
    { name: 'Pickup Truck(2 Door)' },
    { name: 'Pickup Truck(4 Door)' },
    { name: 'Pickup Dually' },
    { name: 'Motorcycle' },
    { name: 'ATV' },
    { name: 'Boat' },
    { name: 'RV' },
    { name: 'Trailer(5th Wheel)' },
    { name: 'Trailer(Bumper Pull)' },
    { name: 'Trailer(Gooseneck)' },
    { name: 'Cargo Van' },
    { name: 'Box Truck' },
    { name: 'Day Cab' },
    { name: 'Sleeper Cab' },
    { name: 'Other' }
];

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.string('name', 32).unique().notNullable().primary();
    }).then((
        result
    ) =>
    {
        knex(table_name).insert(vehicle_type_records);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
