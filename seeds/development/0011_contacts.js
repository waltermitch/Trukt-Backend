const faker = require('faker');

const table_name = 'rcg_tms.contacts';
exports.seed = async function (knex)
{
    return await knex.raw('UPDATE rcg_tms.terminals SET primary_contact = null, alternative_contact = null RETURNING guid;').then((terminals) =>
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
                        contact_for: terminal.guid,
                        created_by: faker.datatype.uuid()
                    });

            return knex.batchInsert(table_name, contacts, 200).then(() =>
            {
                const terminalIds = terminals.map(x => x.guid);
                return knex(table_name).select('guid', 'contact_for').whereIn('contact_for', terminalIds).then(updated_contacts =>
                {

                    const mapped = {};
                    updated_contacts.map(x =>
                    {
                        if (!(x.contactFor in mapped))

                            mapped[x.contactFor] = [];
                        mapped[x.contactFor].push(x);

                    });
                    const proms = [];
                    for (const terminal of terminals)
                    {
                        const term_conts = mapped[terminal.guid];
                        terminal.primaryContact = term_conts[0].guid;
                        terminal.alternativeContact = term_conts[1].guid;
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
