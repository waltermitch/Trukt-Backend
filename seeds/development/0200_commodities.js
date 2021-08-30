const faker = require('faker');
const { ternary_options } = require('../../tools/migration');

const table_name = 'commodities';
exports.seed = function (knex)
{
    // Deletes ALL existing entries
    return knex.transaction(async trx =>
    {
        let capacity_types = await trx.raw('select enum_range(null::rcg_tms.load_capacity_types)');
        capacity_types = JSON.parse(capacity_types.rows[0].enum_range.replace('{', '[').replace('}', ']'));
        return await trx.select('id').from('rcg_tms.commodity_types').then(async types =>
        {
            return await trx.select('id', 'year', 'make', 'model').from('rcg_tms.vehicles').limit(10).then(vehicles =>
            {
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
                        created_by_guid: '00000000-0000-0000-0000-000000000000',
                        description: faker.lorem.words()
                    });
                }

                // Inserts seed entries
                return trx(table_name).insert(commodities);
            });

        });

    });
};
