const Invoice = require('../../src/Models/InvoiceBill');
const InvoiceLine = require('../../src/Models/InvoiceLine');
const InvoiceLineItem = require('../../src/Models/InvoiceLineItem');
const Order = require('../../src/Models/Order');
const currency = require('currency.js');
const User = require('../../src/Models/User');
const faker = require('faker');

exports.seed = async function (knex)
{
    return knex.transaction(async trx =>
    {
        const testUser = await User.query(trx).findOne('name', 'ilike', '%');
        const items = await InvoiceLineItem.query(trx);
        const orders = await Order.query(trx).withGraphFetched('[commodities(distinct), cosignee, client, jobs.[vendor, commodities(distinct)]]');
        for (const order of orders)
        {
            const invoice = Invoice.fromJson({
                externalPartyGuid: order.cosignee?.guid || order.client?.guid,
                order: {
                    guid: order.guid
                },
                lines: [],
                isInvoice: true,
                createdByGuid: testUser.guid,
                referenceNumber: faker.lorem.word().substring(0, 4).padEnd(5, '0') + (faker.datatype.number(9999) + 1000)

            });

            const transportItem = items.find(it => it.name === 'transport');
            if (order.commodities.length > 0)
            {
                const numComs = order.commodities.length;
                const tariffs = currency(order.estimatedRevenue).distribute(numComs);

                for (const commodity of order.commodities)
                {
                    const invoiceline = InvoiceLine.fromJson({
                        itemId: transportItem.id,
                        amount: tariffs.shift(),
                        commodityGuid: commodity.guid,
                        createdByGuid: testUser.guid
                    });

                    invoice.lines.push(invoiceline);

                }
            }

            await Invoice.query(trx).upsertGraph(invoice, { relate: true });

            for (const job of order.jobs)
            {
                if (job.vendorGuid)
                {
                    const bill = Invoice.fromJson({
                        externalPartyGuid: job.vendorGuid,
                        job: {
                            guid: job.guid
                        },
                        lines: [],
                        isInvoice: false,
                        createdByGuid: testUser.guid,
                        referenceNumber: faker.lorem.word().substring(0, 4).padEnd(5, '0') + (faker.datatype.number(9999) + 1000)
                    });

                    const numComs = job.commodities.length;
                    const carrierPays = currency(order.estimatedExpense).distribute(numComs);

                    for (const commodity of job.commodities)
                    {
                        const billline = InvoiceLine.fromJson({
                            itemId: transportItem.id,
                            amount: carrierPays.shift(),
                            commodityGuid: commodity.guid,
                            createdByGuid: testUser.guid
                        });
                        bill.lines.push(billline);
                    }

                    await Invoice.query(trx).upsertGraph(bill, { relate: true });

                }
            }

        }

    });
};
