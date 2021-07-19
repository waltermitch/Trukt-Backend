const Invoice = require('../../src/Models/InvoiceBill');
const InvoiceLine = require('../../src/Models/InvoiceLine');
const InvoiceLineItem = require('../../src/Models/InvoiceLineItem');
const SFAccount = require('../../src/Models/SFAccount');
const faker = require('faker');

const test_user = '00000000-0000-0000-0000-000000000000';

exports.seed = async function (knex)
{
    return knex.transaction(async trx =>
    {
        let client = await SFAccount.query(trx).limit(1);
        client = client[0];
        const items = await InvoiceLineItem.query(trx);
        const invoice = Invoice.fromJson({
            externalPartyGuid: client.guid,
            lines: [],
            isInvoice: true,
            createdByGuid: test_user
        });

        const amount = faker.datatype.number(6) + 4;
        for (let i = 0; i < amount; i++)
        {
            const line = InvoiceLine.fromJson({
                itemId: faker.random.arrayElement(items).id,
                amount: faker.datatype.number(1500) + 50,
                createdByGuid: test_user
            });

            invoice.lines.push(line);
        }

        return Invoice.query(trx).insertGraph(invoice);
    });
};
