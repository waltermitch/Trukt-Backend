const faker = require('faker');

const test_user = '00000000-0000-0000-0000-000000000000';
const table_name = 'rcg_tms.contacts';
exports.seed = async function (knex)
{
    return await knex.raw('UPDATE rcg_tms.terminals SET primary_contact_guid = null, alternative_contact_guid = null RETURNING guid;').then((terminals) =>
    {

        terminals = terminals.rows;
        return knex(table_name).del().then(() =>
        {
            const contacts = [];

            for (const terminal of terminals)

                for (let i = 0; i < 3; i++)

                    contacts.push({
                        first_name: faker.name.firstName(),
                        last_name: faker.name.lastName(),
                        phone_number: faker.phone.phoneNumber(),
                        mobile_number: faker.phone.phoneNumber(),
                        email: faker.internet.email(),
                        terminal_guid: terminal.guid,
                        created_by_guid: test_user
                    });

            return knex.batchInsert(table_name, contacts, 200).then(() =>
            {
                const terminalIds = terminals.map(x => x.guid);

                return knex(table_name).select('guid', 'terminal_guid').whereIn('terminal_guid', terminalIds).then(updated_contacts =>
                {

                    const mapped = {};
                    updated_contacts.map(x =>
                    {
                        if (!(x.terminalGuid in mapped))

                            mapped[x.terminalGuid] = [];
                        mapped[x.terminalGuid].push(x);

                    });
                    const proms = [];
                    for (const terminal of terminals)
                    {
                        const term_conts = mapped[terminal.guid];
                        terminal.primaryContactGuid = term_conts[0].guid;
                        terminal.alternativeContactGuid = term_conts[1].guid;
                        terminal.updatedByGuid = test_user;
                        const tid = terminal.guid;
                        delete terminal.guid;
                        proms.push(knex('rcg_tms.terminals').update(Object.assign({}, terminal)).where('guid', tid));
                    }

                    return Promise.all(proms);
                });
            });
        });
    });
};
