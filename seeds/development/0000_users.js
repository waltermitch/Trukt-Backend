const faker = require('faker');

const table_name = 'rcg_tms.tms_users';
const test_user = '91c185fd-d33a-4664-95ee-0b7d244fcb4b';
exports.seed = function (knex)
{
    const users = [
        {
            guid: test_user,
            name: 'Test Postman'
        }
    ];

    for (let i = 0; i < 200; i++)

        users.push({
            guid: faker.datatype.uuid(),
            name: faker.name.findName()
        });

    return knex.transaction(async trx =>
    {
        // Inserts seed entries
        await trx(table_name).insert(
            users
        ).onConflict(['guid']).ignore();
    });

};
