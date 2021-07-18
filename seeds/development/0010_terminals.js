const faker = require('faker');

const test_user = '00000000-0000-0000-0000-000000000000';
const table_name = 'terminals';
exports.seed = function (knex)
{

    // Deletes ALL existing entries
    return knex.schema.withSchema('rcg_tms').raw('TRUNCATE TABLE rcg_tms.terminals, rcg_tms.contacts CASCADE').then(function ()
    {
        const terminals = [];
        for (let i = 0; i < 30; i++)
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
                country: faker.random.arrayElement(['USA', 'CA']),
                state,
                zip_code: faker.address.zipCodeByState(state),
                latitude: faker.address.latitude(),
                longitude: faker.address.longitude(),
                is_resolved: true,
                created_by_guid: test_user
            });
        }

        // Inserts seed entries
        return knex(table_name).insert(terminals).onConflict(['latitude', 'longitude'], ['name']).ignore();
    });
};
