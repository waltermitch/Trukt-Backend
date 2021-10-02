const faker = require('faker');

exports.seed = async function (knex)
{
    let user = await knex('tms_users').withSchema('rcg_tms').select('guid').limit(1);
    user = user[0];

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
            created_by_guid: user.guid
        });
    }

    return knex('terminals').withSchema('rcg_tms').insert(terminals);

};
