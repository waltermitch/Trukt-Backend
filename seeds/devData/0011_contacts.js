const faker = require('faker');
const Terminal = require('../../src/Models/Terminal');
const TerminalContact = require('../../src/Models/TerminalContact');
const User = require('../../src/Models/User');

exports.seed = async function (knex)
{
    const user = await User.query(knex).findOne('name', 'ilike', '%');
    let terminals = await Terminal.query(knex).whereNull('primaryContactGuid');

    const contacts = [];
    for (const terminal of terminals)
    {
        const numContacts = faker.datatype.number(10);
        for (let i = 0; i < numContacts; i++)
        {
            const contact = TerminalContact.fromJson({
                name: faker.name.firstName() + ' ' + faker.name.lastName(),
                phoneNumber: faker.phone.phoneNumber('(###) ###-####'),
                mobileNumber: faker.phone.phoneNumber('(###) ###-####'),
                email: faker.internet.email()
            });
            contact.linkTerminal(terminal);
            contact.setCreatedBy(user);
            contacts.push(contact);
        }
    }

    if (terminals.length > 0)
    {
        await TerminalContact.query(knex).insert(contacts).onConflict(['terminalGuid', 'name', 'phoneNumber']).ignore();

        terminals = await Terminal.query(knex).whereNull('primaryContactGuid').withGraphJoined('contacts');

        for (const terminal of terminals)
        {
            terminal.primaryContact = terminal.contacts[0];
            terminal.alternativeContact = terminal.contacts[1];
            terminal.setUpdatedBy(user);
        }

        terminals = await Terminal.query(knex).upsertGraphAndFetch(terminals, { noDelete: true, relate: true, allowRefs: true });
    }
    return knex;
};
