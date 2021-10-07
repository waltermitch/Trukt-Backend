const SFAccount = require('../../src/Models/SFAccount');
const SFContact = require('../../src/Models/SFContact');
const SFRecordType = require('../../src/Models/SFRecordType');
const faker = require('faker');

const CONTACT_TYPES = ['Account Contact', 'MCP_Survey', 'Customer Contact'];

const ACCOUNT_TYPES = [
    'Client',
    'Customer Terminal',
    'Factoring Company',
    'Vendor',
    'Terminal',
    'Employee',
    'Referrer',
    'Carrier',
    'Person Account'
];

function newSFID()
{
    return faker.datatype.string(18).replace(/[^a-zA-Z0-9]/g, () => faker.datatype.number({ min: 0, max: 9, precision: 1 }));
}

exports.seed = async function (knex)
{
    const accounts = [];
    const contacts = [];
    const rectypes = [];

    const [rectypesContacts, rectypesAccounts] = await Promise.all([SFRecordType.query(knex).whereIn('name', CONTACT_TYPES), SFRecordType.query(knex).whereIn('name', ACCOUNT_TYPES)]);

    if (rectypesContacts.length == 0)
    {
        for (const type of CONTACT_TYPES)
        {
            const rectype = SFRecordType.fromJson({
                name: type,
                objectType: 'Contact',
                sfId: newSFID()
            });
            rectypesContacts.push(rectype);
            rectypes.push(rectype);
        }
    }

    if (rectypesAccounts.length == 0)
    {
        for (const type of ACCOUNT_TYPES)
        {
            const rectype = SFRecordType.fromJson({
                name: type,
                objectType: 'Account',
                sfId: newSFID()
            });
            rectypesAccounts.push(rectype);
            rectypes.push(rectype);
        }
    }

    for (const rectype of rectypesAccounts)
    {
        for (let i = 0; i < 10; i++)
        {
            const account = SFAccount.fromJson({
                name: faker.company.companyName(),
                sfId: newSFID()
            });

            account.linkRecordType(rectype);
            accounts.push(account);
        }
    }

    for (const rectype of rectypesContacts)
    {
        for (const account of accounts)
        {
            for (let i = 0; i < 3; i++)
            {
                const contact = SFContact.fromJson({
                    name: faker.name.firstName() + faker.name.lastName(),
                    sfId: newSFID()
                });

                account.linkPrimaryContact(contact);
                contact.linkRecordType(rectype);
                contact.linkAccount(account);
                contacts.push(contact);
            }
        }
    }

    if (rectypes.length > 0)
    {
        await SFRecordType.query(knex).insert(rectypes);
    }
    await Promise.all([SFContact.query(knex).insert(contacts), SFAccount.query(knex).insert(accounts)]);
};