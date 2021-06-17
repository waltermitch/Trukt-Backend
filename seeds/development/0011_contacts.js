const faker = require('faker');

const table_name = 'rcg_tms.contacts';
exports.seed = async function (knex)
{
    return await knex.select('guid').from('rcg_tms.terminals').then((results) =>
    {
        return knex(table_name).del().then(() =>
        {
            const contacts = [];

            for (const terminal of results)

                for (let i = 0; i < 10; i++)

                    contacts.push({
                        first_name: faker.name.firstName(),
                        last_name: faker.name.lastName(),
                        phone_number: faker.phone.phoneNumber(),
                        mobile_number: faker.phone.phoneNumber(),
                        email: faker.internet.email(),
                        contact_for: terminal.guid,
                        created_by: faker.datatype.uuid()
                    });

            return knex.batchInsert(table_name, contacts, 200);
        });
    });
};
