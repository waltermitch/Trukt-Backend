const faker = require('faker');

const table_name = 'terminals';
exports.seed = function (knex)
{

    // Deletes ALL existing entries
    return knex(table_name).del()
        .then(function ()
        {
            const terminals = [];
            for (let i = 0; i < 1000; i++)
            {
                const state = faker.address.state();
                terminals.push({
                    name: faker.company.companyName(),
                    location_type: faker.random.arrayElement([
                        'dealer',
                        'private',
                        'auction',
                        'repo yard',
                        'port',
                        'business'
                    ]),
                    street1: faker.address.streetAddress(),
                    street2: faker.datatype.number(100) < 75 ? faker.address.secondaryAddress() : null,
                    city: faker.address.city(),
                    state,
                    zip_code: faker.address.zipCodeByState(state),
                    latitude: faker.address.latitude(),
                    longitude: faker.address.longitude(),
                    is_resolved: true,
                    created_by: faker.datatype.uuid()
                });
            }

            // Inserts seed entries
            return knex(table_name).insert(terminals).onConflict(['latitude', 'longitude'], ['name']).ignore();
        });
};
