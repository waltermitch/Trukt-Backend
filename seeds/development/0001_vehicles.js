const faker = require('faker');

const table_name = 'vehicles';

exports.seed = function (knex)
{
    const vehicles = [];
    for (let i = 0; i < 1000; i++)
        vehicles.push({
            year: faker.datatype.number(70) + 1950,
            make: faker.vehicle.manufacturer(),
            model: faker.vehicle.model(),
            trim: faker.random.alpha(2)
        });
    return knex.transaction(async trx =>
    {
        // Inserts seed entries
        return trx(table_name).insert(
            vehicles
        ).onConflict([
            'year',
            'make',
            'model',
            'trim'
        ]).ignore();
    });
};
