/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const SFAccount = require('../../../../src/Models/SFAccount');
const SFRecordType = require('../../../../src/Models/SFRecordType');
const Order = require('../../../../src/Models/Order');
const OrderJob = require('../../../../src/Models/OrderJob');
const LineItem = require('../../../../src/Models/InvoiceLineItem');
const InvoiceLine = require('../../../../src/Models/InvoiceLine');
const BaseModel = require('../../../../src/Models/BaseModel');
const currency = require('currency.js');

describe('Tests setting Order finance fields through Invoice Line triggers', () =>
{
    const EXPENSE_ID = 100000;
    const REVENUE_ID = 100001;
    const ZERO_MONEY = "0.00";
    const context = {};
    let trx;

    beforeEach(async () =>
    {
        trx = await BaseModel.startTransaction();

        // data setup
        const [clientType, lineItems] = await Promise.all([
            SFRecordType.query(trx).select().modify('byType', 'Account').modify('byName', 'Client'),
            LineItem.query(trx).insert([
                // put huge ids so we dont have conflict with existing data
                { id: EXPENSE_ID, name: 'test expense', type: 'expense' },
                { id: REVENUE_ID, name: 'test revenue', type: 'revenue' }
            ])
        ]);

        const client = await SFAccount.query(trx).insertAndFetch(SFAccount.fromJson({
            name: 'Integration Test Client',
            recordTypeId: clientType.sfId,
            accountSource: 'Integration Test',
            description: 'This client is from an integration test, if you find this client in a live environment, please delete'
        }));

        context.order = await Order.query(trx)
            .insertGraphAndFetch(Order.fromJson({
                createdByGuid: process.env.SYSTEM_USER,
                referenceNumber: 'test',
                clientGuid: client.guid,
                jobs: [
                    {
                        createdByGuid: process.env.SYSTEM_USER,
                        isTransport: true,
                        typeId: 1,
                        bills: [
                            {
                                isInvoice: false,
                                referenceNumber: 'DELETE-ME2',
                                isValid: true,
                                createdByGuid: process.env.SYSTEM_USER
                            }
                        ]
                    }
                ],
                invoices: [
                    {
                        isInvoice: true,
                        referenceNumber: 'DELETE-ME1',
                        isValid: true,
                        createdByGuid: process.env.SYSTEM_USER
                    }
                ]
            }), { relate: true });

        context.invoiceLines = [
            InvoiceLine.fromJson({
                invoiceGuid: context.order.invoices[0].guid,
                amount: "54.00",
                itemId: EXPENSE_ID,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            }),
            InvoiceLine.fromJson({
                invoiceGuid: context.order.invoices[0].guid,
                amount: "66.00",
                itemId: REVENUE_ID,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            })
        ];

        context.billLines = [
            InvoiceLine.fromJson({
                invoiceGuid: context.order.jobs[0].bills[0].guid,
                amount: "45.00",
                itemId: EXPENSE_ID,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            }),
            InvoiceLine.fromJson({
                invoiceGuid: context.order.jobs[0].bills[0].guid,
                amount: "55.00",
                itemId: REVENUE_ID,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            })
        ];
    });

    // after each test, rollback all the data that was inserted
    afterEach(async () =>
    {
        await trx.rollback();
    });

    afterAll(async () =>
    {
        // close the connection to the database because it will hang otherwise
        BaseModel.knex().destroy();
    });

    /**
     *  TESTING EXPENSE TYPE INVOICE LINES
     */

    it('Order and OrderJob finance fields start at 0.00', async () =>
    {
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        for (const field of ['actualRevenue', 'actualExpense', 'actualIncome'])
        {
            expect(order[field]).toBe(ZERO_MONEY);
            expect(job[field]).toBe(ZERO_MONEY);
        }
    })

    it('Order expense is set properly when adding InvoiceLine', async () =>
    {
        const sourceLine = context.invoiceLines[0];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine);
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedAmount = sourceLine.amount;
        const expectedNegAmount = currency(0).subtract(expectedAmount).toString();

        expect(invoiceLine.amount).toEqual(expectedAmount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(expectedAmount);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(expectedNegAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order expense is updated properly when updating InvoiceLine amount', async () => 
    {
        const sourceLine = context.invoiceLines[0];
        // pg returns decimal in string format.
        const expectedAmount = currency(sourceLine.amount).add(100).toString();
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.amount = expectedAmount;
                return InvoiceLine.query(trx).patchAndFetchById(clone.guid, clone);
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedNegAmount = currency(0).subtract(expectedAmount).toString();

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(expectedAmount);
        expect(order.actualRevenue).toBe(ZERO_MONEY)
        expect(order.actualIncome).toBe(expectedNegAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY)
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order expense is updated properly when updating InvoiceLine', async () => 
    {
        const sourceLine = context.invoiceLines[0];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.transactionNumber = 'NEWTRX10005';
                return InvoiceLine.query(trx).patch(clone);
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedAmount = sourceLine.amount;
        const expectedNegAmount = currency(ZERO_MONEY).subtract(expectedAmount).toString();

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(expectedAmount);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(expectedNegAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY)
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order expense is updated properly when soft-deleting InvoiceLine', async () => 
    {
        const sourceLine = context.invoiceLines[0];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.isDeleted = true;
                return InvoiceLine.query(trx).patchAndFetchById(clone.guid, clone);
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedAmount = sourceLine.amount;

        // even though it is soft deleted, the amount should not change
        expect(invoiceLine.amount).toBe(expectedAmount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order expense is updated properly when un-deleting InvoiceLine', async () => 
    {
        const sourceLine = context.invoiceLines[0];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.isDeleted = true;
                return InvoiceLine.query(trx)
                    .patchAndFetchById(clone.guid, clone)
                    .then(deletedInvoiceLine =>
                    {
                        deletedInvoiceLine.isDeleted = false;
                        return InvoiceLine.query(trx)
                            .patchAndFetchById(deletedInvoiceLine.guid, deletedInvoiceLine);
                    });
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedAmount = sourceLine.amount;
        const expectedNegAmount = currency(0).subtract(expectedAmount).toString();
        // even though it is soft deleted, the amount should not change
        expect(invoiceLine.amount).toBe(expectedAmount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(expectedAmount);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(expectedNegAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order expense is updated properly when hard deleting InvoiceLine', async () => 
    {
        const sourceLine = context.invoiceLines[0];
        const invoiceLine = await InvoiceLine.query(trx)
            .insert(sourceLine)
            .then(newInvoiceLine =>
            {
                return InvoiceLine.query(trx)
                    .deleteById(newInvoiceLine.guid)
                    .then(() =>
                    {
                        return InvoiceLine.query(trx).findById(newInvoiceLine.guid);
                    });
            });

        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expect(invoiceLine).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order expense is updated properly when hard deleting a soft-deleted InvoiceLine', async () => 
    {
        const sourceLine = context.invoiceLines[0];
        const invoiceLine = await InvoiceLine.query(trx)
            .insert(sourceLine)
            .then(newInvoiceLine =>
            {
                return InvoiceLine.query(trx).patchAndFetchById(newInvoiceLine.guid, { isDeleted: true })
                    .then(() =>
                    {
                        return InvoiceLine.query(trx)
                            .deleteById(newInvoiceLine.guid)
                            .then(() =>
                            {
                                return InvoiceLine.query(trx).findById(newInvoiceLine.guid);
                            });
                    })
            });

        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expect(invoiceLine).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    /**
     *  TESTING REVENUE TYPE INVOICE LINES
     */

    it('Order revenue is set properly when adding InvoiceLine', async () =>
    {
        const sourceLine = context.invoiceLines[1];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine);
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedAmount = sourceLine.amount;

        expect(invoiceLine.amount).toEqual(expectedAmount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order revenue is updated properly when updating InvoiceLine amount', async () =>
    {
        const sourceLine = context.invoiceLines[1];
        // pg returns decimal in string format.
        const expectedAmount = currency(context.invoiceLines[1].amount).add(100).toString();
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.amount = expectedAmount;
                return InvoiceLine.query(trx).patchAndFetchById(clone.guid, clone);
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount)
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY)
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order revenue is updated properly when updating InvoiceLine', async () =>
    {
        const sourceLine = context.invoiceLines[1];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.transactionNumber = 'NEWTRX10005';
                return InvoiceLine.query(trx).patch(clone);
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedAmount = sourceLine.amount;

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY)
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order revenue is updated properly when soft-deleting InvoiceLine', async () =>
    {
        const sourceLine = context.invoiceLines[1];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.isDeleted = true;
                return InvoiceLine.query(trx).patchAndFetchById(clone.guid, clone);
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // even though it is soft deleted, the amount should not change
        expect(invoiceLine.amount).toBe(sourceLine.amount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order revenue is updated properly when un-deleting InvoiceLine', async () =>
    {
        const sourceLine = context.invoiceLines[1];
        const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
            .then(newInvoiceLine =>
            {
                const clone = InvoiceLine.fromJson(newInvoiceLine);
                clone.isDeleted = true;
                return InvoiceLine.query(trx)
                    .patchAndFetchById(clone.guid, clone)
                    .then(deletedInvoiceLine =>
                    {
                        deletedInvoiceLine.isDeleted = false;
                        return InvoiceLine.query(trx)
                            .patchAndFetchById(deletedInvoiceLine.guid, deletedInvoiceLine);
                    });
            });
        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        const expectedAmount = sourceLine.amount;
        // even though it is soft deleted, the amount should not change
        expect(invoiceLine.amount).toBe(expectedAmount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order revenue is updated properly when hard deleting InvoiceLine', async () =>
    {
        const sourceLine = context.invoiceLines[1];
        const invoiceLine = await InvoiceLine.query(trx)
            .insert(sourceLine)
            .then(newInvoiceLine =>
            {
                return InvoiceLine.query(trx)
                    .deleteById(newInvoiceLine.guid)
                    .then(() =>
                    {
                        return InvoiceLine.query(trx).findById(newInvoiceLine.guid);
                    });
            });

        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expect(invoiceLine).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    it('Order revenue is updated properly when hard deleting a soft-deleted InvoiceLine', async () =>
    {
        const sourceLine = context.invoiceLines[1];
        const invoiceLine = await InvoiceLine.query(trx)
            .insert(sourceLine)
            .then(newInvoiceLine =>
            {
                return InvoiceLine.query(trx).patchAndFetchById(newInvoiceLine.guid, { isDeleted: true })
                    .then(() =>
                    {
                        return InvoiceLine.query(trx)
                            .deleteById(newInvoiceLine.guid)
                            .then(() =>
                            {
                                return InvoiceLine.query(trx).findById(newInvoiceLine.guid);
                            });
                    })
            });

        const [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expect(invoiceLine).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });

    /**
     *  TEST REVENUE AND REVENUE INTERACTION WITH ORDER
     */

    it('Order finance fields are set properly with all InvoiceLines Revenue CRUD', async () =>
    {
        const sourceLines = [{
            invoiceGuid: context.order.invoices[0].guid, amount: '3200.00', itemId: REVENUE_ID,
            createdByGuid: process.env.SYSTEM_USER
        },
        {
            invoiceGuid: context.order.invoices[0].guid, amount: '1200.56', itemId: REVENUE_ID,
            createdByGuid: process.env.SYSTEM_USER
        }];

        let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
        sourceLines[0].guid = invoiceLines[0].guid;
        sourceLines[1].guid = invoiceLines[1].guid;

        let [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
        expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);
        let expectedAmount = currency(sourceLines[0].amount).add(sourceLines[1].amount).toString();

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
         */
        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH $$$$ AMOUNT UPDATE
         */
        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: currency(line.amount).add(100).value });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[0].amount).add(sourceLines[1].amount).add(200).toString();

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            // this effectively subtracts 100 because it resets the value to the original
            return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[0].amount).add(sourceLines[1].amount).toString();

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH SOFT-DELETE
         */

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[0].guid, { isDeleted: true })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[1].amount).toString();

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[1].guid, { isDeleted: true })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[0].guid, { isDeleted: false })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[0].amount).toString();
        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[1].guid, { isDeleted: false })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[0].amount).add(sourceLines[1].amount).toString();
        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST HARD-DELETING OF THE INVOICE LINES
         */

        // WITH SOFT DELETES
        invoiceLines = await InvoiceLine.query(trx)
            .patch({ isDeleted: true })
            .whereIn('guid', [sourceLines[0].guid, sourceLines[1].guid])
            .then(() =>
            {
                return InvoiceLine.query(trx).findByIds([sourceLines[0].guid, sourceLines[1].guid]).delete()
                    .then(() =>
                    {
                        return Promise.all([
                            InvoiceLine.query(trx).findById(sourceLines[0].guid),
                            InvoiceLine.query(trx).findById(sourceLines[1].guid)
                        ]);
                    });
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0]).toBe(undefined);
        expect(invoiceLines[1]).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        delete sourceLines[0].guid;
        delete sourceLines[1].guid;
        invoiceLines = await InvoiceLine.query(trx).insertAndFetch(sourceLines).then((newInvoiceLines) =>
        {
            return InvoiceLine.query(trx).findByIds(newInvoiceLines.map(it => it.guid)).delete()
                .then(() =>
                {
                    return Promise.all([
                        InvoiceLine.query(trx).findById(newInvoiceLines[0].guid),
                        InvoiceLine.query(trx).findById(newInvoiceLines[1].guid)
                    ]);
                });
        });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0]).toBe(undefined);
        expect(invoiceLines[1]).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

    });

    /**
     *  TEST REVENUE AND EXPENSE INTERACTION WITH ORDER
     */

    it('Order finance fields are set properly with all InvoiceLines Revenue and Expense CRUD', async () =>
    {
        const sourceLines = [{
            invoiceGuid: context.order.invoices[0].guid, amount: '3200.00', itemId: REVENUE_ID,
            createdByGuid: process.env.SYSTEM_USER
        },
        {
            invoiceGuid: context.order.invoices[0].guid, amount: '1200.56', itemId: EXPENSE_ID,
            createdByGuid: process.env.SYSTEM_USER
        }];

        let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
        sourceLines[0].guid = invoiceLines[0].guid;
        sourceLines[1].guid = invoiceLines[1].guid;

        let [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
        expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);
        let expectedAmount = currency(sourceLines[0].amount).subtract(sourceLines[1].amount).toString();

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(sourceLines[1].amount);
        expect(order.actualRevenue).toBe(sourceLines[0].amount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
         */
        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(sourceLines[1].amount);
        expect(order.actualRevenue).toBe(sourceLines[0].amount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH $$$$ AMOUNT UPDATE
         */
        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: "1800" });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe("1800.00");
        expect(order.actualRevenue).toBe("1800.00");
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            // this effectively subtracts 100 because it resets the value to the original
            return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[0].amount).subtract(sourceLines[1].amount).toString();

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(sourceLines[1].amount);
        expect(order.actualRevenue).toBe(sourceLines[0].amount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH SOFT-DELETE
         */

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[0].guid, { isDeleted: true })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(0).subtract(sourceLines[1].amount).toString();

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(sourceLines[1].amount);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[1].guid, { isDeleted: true })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[0].guid, { isDeleted: false })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[0].amount).toString();
        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(expectedAmount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[1].guid, { isDeleted: false })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expectedAmount = currency(sourceLines[0].amount).subtract(sourceLines[1].amount).toString();
        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(sourceLines[1].amount);
        expect(order.actualRevenue).toBe(sourceLines[0].amount);
        expect(order.actualIncome).toBe(expectedAmount);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST HARD-DELETING OF THE INVOICE LINES
         */

        // WITH SOFT DELETES
        invoiceLines = await InvoiceLine.query(trx)
            .patch({ isDeleted: true })
            .whereIn('guid', [sourceLines[0].guid, sourceLines[1].guid])
            .then(() =>
            {
                return InvoiceLine.query(trx).findByIds([sourceLines[0].guid, sourceLines[1].guid]).delete()
                    .then(() =>
                    {
                        return Promise.all([
                            InvoiceLine.query(trx).findById(sourceLines[0].guid),
                            InvoiceLine.query(trx).findById(sourceLines[1].guid)
                        ]);
                    });
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0]).toBe(undefined);
        expect(invoiceLines[1]).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        delete sourceLines[0].guid;
        delete sourceLines[1].guid;
        invoiceLines = await InvoiceLine.query(trx).insertAndFetch(sourceLines).then((newInvoiceLines) =>
        {
            return InvoiceLine.query(trx).findByIds(newInvoiceLines.map(it => it.guid)).delete()
                .then(() =>
                {
                    return Promise.all([
                        InvoiceLine.query(trx).findById(newInvoiceLines[0].guid),
                        InvoiceLine.query(trx).findById(newInvoiceLines[1].guid)
                    ]);
                });
        });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0]).toBe(undefined);
        expect(invoiceLines[1]).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

    });

    /**
     *  TEST REVENUE AND EXPENSE INTERACTION WITH ORDER
     */

    it('Order finance fields are set properly with all InvoiceLines Expense CRUD', async () =>
    {

        const NEG_EXPECTED = "-4400.56";
        const SUM_EXPECTED = "4400.56";
        const sourceLines = [{
            invoiceGuid: context.order.invoices[0].guid, amount: '3200.00', itemId: EXPENSE_ID,
            createdByGuid: process.env.SYSTEM_USER
        },
        {
            invoiceGuid: context.order.invoices[0].guid, amount: '1200.56', itemId: EXPENSE_ID,
            createdByGuid: process.env.SYSTEM_USER
        }];

        let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
        sourceLines[0].guid = invoiceLines[0].guid;
        sourceLines[1].guid = invoiceLines[1].guid;

        let [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
        expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(SUM_EXPECTED);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(NEG_EXPECTED);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
         */
        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(SUM_EXPECTED);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(NEG_EXPECTED);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH $$$$ AMOUNT UPDATE
         */
        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: "1800" });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe("3600.00");
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe("-3600.00");

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await Promise.all(sourceLines.map(line =>
        {
            return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
        }));

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(SUM_EXPECTED);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(NEG_EXPECTED);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST WITH SOFT-DELETE
         */

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[0].guid, { isDeleted: true })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(sourceLines[0].amount);
        expect(invoiceLines[1].amount).toBe(sourceLines[1].amount);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(sourceLines[1].amount);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(currency(0).subtract(sourceLines[1].amount).toString());

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[1].guid, { isDeleted: true })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[0].guid, { isDeleted: false })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(sourceLines[0].amount);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(currency(0).subtract(sourceLines[0].amount).toString());

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        invoiceLines = await InvoiceLine.query(trx).patchAndFetchById(sourceLines[1].guid, { isDeleted: false })
            .then(() =>
            {
                return Promise.all([
                    InvoiceLine.query(trx).findById(sourceLines[0].guid),
                    InvoiceLine.query(trx).findById(sourceLines[1].guid)
                ]);
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0].amount).toBe(currency(sourceLines[0].amount).toString());
        expect(invoiceLines[1].amount).toBe(currency(sourceLines[1].amount).toString());

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(SUM_EXPECTED);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(NEG_EXPECTED);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        /**
         *  TEST HARD-DELETING OF THE INVOICE LINES
         */

        // WITH SOFT DELETES
        invoiceLines = await InvoiceLine.query(trx)
            .patch({ isDeleted: true })
            .whereIn('guid', [sourceLines[0].guid, sourceLines[1].guid])
            .then(() =>
            {
                return InvoiceLine.query(trx).findByIds([sourceLines[0].guid, sourceLines[1].guid]).delete()
                    .then(() =>
                    {
                        return Promise.all([
                            InvoiceLine.query(trx).findById(sourceLines[0].guid),
                            InvoiceLine.query(trx).findById(sourceLines[1].guid)
                        ]);
                    });
            });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0]).toBe(undefined);
        expect(invoiceLines[1]).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);

        delete sourceLines[0].guid;
        delete sourceLines[1].guid;
        invoiceLines = await InvoiceLine.query(trx).insertAndFetch(sourceLines).then((newInvoiceLines) =>
        {
            return InvoiceLine.query(trx).findByIds(newInvoiceLines.map(it => it.guid)).delete()
                .then(() =>
                {
                    return Promise.all([
                        InvoiceLine.query(trx).findById(newInvoiceLines[0].guid),
                        InvoiceLine.query(trx).findById(newInvoiceLines[1].guid)
                    ]);
                });
        });

        [order, job] = await Promise.all([
            Order.query(trx).findById(context.order.guid),
            OrderJob.query(trx).findById(context.order.jobs[0].guid)
        ]);

        // soft deleted, so nothing should be broken
        expect(invoiceLines[0]).toBe(undefined);
        expect(invoiceLines[1]).toBe(undefined);

        // invoice line was only added to the order
        expect(order.actualExpense).toBe(ZERO_MONEY);
        expect(order.actualRevenue).toBe(ZERO_MONEY);
        expect(order.actualIncome).toBe(ZERO_MONEY);

        // invoice line was not linked to the job so all values should be 0
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    });
});