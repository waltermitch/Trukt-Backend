/**
 * @description generates an invoice that is detached from orders or jobs.
 * This is intended to only test the invoice functionality
 */
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
        let client = await SFAccount.query(trx).whereNotNull('guid').limit(1);
        client = client[0];
        if (!client)
        {
            throw new Error('No SF client accounts found. Do you have the salesforce data?');
        }
        const items = await InvoiceLineItem.query(trx);
        if (items.length < 1)
        {
            throw new Error('No invoice line items found. Please add invoice line items to the database.');
        }
        const invoice = Invoice.fromJson({
            consigneeGuid: client.guid,
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
