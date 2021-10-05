const faker = require('faker');
const { ternary_options } = require('../../tools/migration');
const User = require('../../src/Models/User');

const table_name = 'commodities';
exports.seed = async function (knex)
{
    const user = await User.query(knex).findOne('name', 'TMS System');

    let capacity_types = await knex.raw('select enum_range(null::rcg_tms.load_capacity_types)');
    capacity_types = JSON.parse(capacity_types.rows[0].enum_range.replace('{', '[').replace('}', ']'));

    if (capacity_types.length == 0) throw new Error('No capacity types found. Please run capacity types seed.');

    return await knex.select('id').from('rcg_tms.commodity_types').then(async types =>
    {
        if (types.length == 0) throw new Error('No commodity types found. Please run commodity types seed.');
        return await knex.select('id', 'year', 'make', 'model').from('rcg_tms.vehicles').limit(10).then(vehicles =>
        {
            if (vehicles.length == 0) throw new Error('No vehicles found. Please run vehicle seed.');
            const commodities = [];
            for (let i = 0; i < vehicles.length; i++)
            {
                const vehicle = vehicles[i];
                commodities.push({
                    type_id: faker.random.arrayElement(types).id,
                    identifier: faker.vehicle.vin(),
                    vehicle_id: vehicle.id,
                    capacity: faker.random.arrayElement(capacity_types),
                    delivery_status: 'none',
                    length: faker.datatype.number(12),
                    weight: faker.datatype.number(3000),
                    quantity: 1,
                    damaged: faker.random.arrayElement(ternary_options),
                    inoperable: faker.random.arrayElement(ternary_options),
                    created_by_guid: user.guid,
                    description: faker.lorem.words()
                });
            }

            // Inserts seed entries
            return knex(table_name).insert(commodities);
        });
    });

};
