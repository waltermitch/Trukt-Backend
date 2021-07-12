const faker = require('faker');

const table_name = 'tms_users';

exports.seed = function (knex)
{
    return knex(table_name)
        .then(function ()
        {
            const users = [
                {
                    guid: '00000000-0000-0000-0000-000000000000',
                    name: 'Test Postman'
                }
            ];

            for (let i = 0; i < 200; i++)
                users.push({
                    guid: faker.datatype.uuid(),
                    name: faker.name.findName()
                });

            // Inserts seed entries
            return knex(table_name).insert(
                users
            ).onConflict([
                'guid'
            ]).ignore();
        });

};
