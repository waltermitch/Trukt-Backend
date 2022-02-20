/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const SFAccount = require('../../../../src/Models/SFAccount');
const Order = require('../../../../src/Models/Order');
const OrderJob = require('../../../../src/Models/OrderJob');
const InvoiceLineLink = require('../../../../src/Models/InvoiceLineLink');
const InvoiceLineItem = require('../../../../src/Models/InvoiceLineItem');
const InvoiceLine = require('../../../../src/Models/InvoiceLine');
const InvoiceBill = require('../../../../src/Models/InvoiceBill');
const BaseModel = require('../../../../src/Models/BaseModel');
const currency = require('currency.js');
const data = require('./OrderJobFinanceFields.data.json');

const { SYSTEM_USER } = process.env;
const ZERO_MONEY = '0.00';
const EXPENSE_ID = data.InvoiceLineItems[0].id;
const REVENUE_ID = data.InvoiceLineItems[1].id;
const context = {};
let trx;

function expectOrderFieldsToMatchFactory(curTrx, orderGuid, jobGuid)
{
    return async (expense, revenue, income) =>
    {
        const [order, job] = await Promise.all([Order.query(curTrx).findById(orderGuid), OrderJob.query(curTrx).findById(jobGuid)]);

        // invoice line was added to the bill, but is "linked" (implicitly) to the order as well
        expect(order.actualExpense).toBe(expense);
        expect(order.actualRevenue).toBe(revenue);
        expect(order.actualIncome).toBe(income);

        // bill lines are always linked to orders.
        // job finances should match the order with only 1 job.
        expect(job.actualExpense).toBe(ZERO_MONEY);
        expect(job.actualRevenue).toBe(ZERO_MONEY);
        expect(job.actualIncome).toBe(ZERO_MONEY);
    };
}

function expectFieldsToMatchFactory(curTrx, orderGuid, jobGuid)
{
    return async (expense, revenue, income) =>
    {
        const [order, job] = await Promise.all([Order.query(curTrx).findById(orderGuid), OrderJob.query(curTrx).findById(jobGuid)]);

        // invoice line was added to the bill, but is "linked" (implicitly) to the order as well
        expect(order.actualExpense).toBe(expense);
        expect(order.actualRevenue).toBe(revenue);
        expect(order.actualIncome).toBe(income);

        // bill lines are always linked to orders.
        // job finances should match the order with only 1 job.
        expect(job.actualExpense).toBe(expense);
        expect(job.actualRevenue).toBe(revenue);
        expect(job.actualIncome).toBe(income);
    };
}

describe('Actual Finance Fields', () =>
{
    beforeEach(async () =>
    {
        trx = await BaseModel.startTransaction();

        // data setup
        const [lineItems, client] = await Promise.all([InvoiceLineItem.query(trx).insertAndFetch(data.InvoiceLineItems), SFAccount.query(trx).insertAndFetch(data.Client)]);

        const order = Order.fromJson(data.Order);
        const job = OrderJob.fromJson(data.Job);
        const invoice = InvoiceBill.fromJson(data.Invoice);
        const bill = InvoiceBill.fromJson(data.Bill);

        order.setCreatedBy(SYSTEM_USER);
        job.setCreatedBy(SYSTEM_USER);
        invoice.setCreatedBy(SYSTEM_USER);
        bill.setCreatedBy(SYSTEM_USER);

        job.bills = [bill];
        order.jobs = [job];
        order.invoices = [invoice];
        order.client = client;

        context.order = await Order.query(trx).insertGraphAndFetch(order, { relate: true });
        context.job = context.order.jobs[0];
        context.invoice = context.order.invoices[0];
        context.bill = context.job.bills[0];

        context.invoiceLines = data.InvoiceLines.map((json) =>
        {
            const line = InvoiceLine.fromJson(json);
            line.setCreatedBy(SYSTEM_USER);
            line.invoiceGuid = context.order.invoices[0].guid;
            return line;
        });
        context.billLines = data.BillLines.map((json) =>
        {
            const line = InvoiceLine.fromJson(json);
            line.setCreatedBy(SYSTEM_USER);
            line.invoiceGuid = context.order.jobs[0].bills[0].guid;
            return line;
        });
        context.invoiceLines[0].itemId = EXPENSE_ID;
        context.invoiceLines[1].itemId = REVENUE_ID;
        context.billLines[0].itemId = EXPENSE_ID;
        context.billLines[1].itemId = REVENUE_ID;
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

    it('Initialize to 0.00', async () =>
    {
        const [order, job] = await Promise.all([Order.query(trx).findById(context.order.guid), OrderJob.query(trx).findById(context.job.guid)]);

        for (const field of ['actualRevenue', 'actualExpense', 'actualIncome'])
        {
            expect(order[field]).toBe(ZERO_MONEY);
            expect(job[field]).toBe(ZERO_MONEY);
        }
    });

    describe('Invoice Lines Only', () =>
    {
        describe('Expense Lines', () =>
        {
            it('Add', async () =>
            {
                const sourceLine = context.invoiceLines[0];
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine);
                const INCOME_AMOUNT = currency(0).subtract(sourceLine.amount).toString();

                expect(invoiceLine.amount).toEqual(sourceLine.amount);
                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(sourceLine.amount, ZERO_MONEY, INCOME_AMOUNT);
            });

            it('Update Amount', async () =>
            {
                const sourceLine = context.invoiceLines[0];

                // pg returns decimal in string format.
                const EXPECTED_AMOUNT = currency(sourceLine.amount).add(100).toString();
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        const clone = InvoiceLine.fromJson(newInvoiceLine);
                        clone.amount = EXPECTED_AMOUNT;
                        return InvoiceLine.query(trx).patchAndFetchById(clone.guid, clone);
                    });

                const INCOME_AMOUNT = currency(0).subtract(EXPECTED_AMOUNT).toString();
                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(EXPECTED_AMOUNT, ZERO_MONEY, INCOME_AMOUNT);
            });

            it('Update', async () =>
            {
                const sourceLine = context.invoiceLines[0];
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        newInvoiceLine.transactionNumber = 'NEWTRX10005';
                        return InvoiceLine.query(trx).patchAndFetchById(newInvoiceLine.guid, newInvoiceLine);
                    });

                const INCOME_AMOUNT = currency(0).subtract(sourceLine.amount).toString();
                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(sourceLine.amount, ZERO_MONEY, INCOME_AMOUNT);
            });

            it('Hard Delete', async () =>
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

                expect(invoiceLine).toBe(undefined);
                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);

            });
        });

        describe('Revenue Lines', () =>
        {
            it('Add', async () =>
            {
                const sourceLine = context.invoiceLines[1];
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine);

                expect(invoiceLine.amount).toEqual(sourceLine.amount);
                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(ZERO_MONEY, sourceLine.amount, sourceLine.amount);
            });

            it('Update Amount', async () =>
            {
                const sourceLine = context.invoiceLines[1];

                // pg returns decimal in string format.
                const EXPECTED_AMOUNT = currency(context.invoiceLines[1].amount).add(100).toString();
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        const clone = InvoiceLine.fromJson(newInvoiceLine);
                        clone.amount = EXPECTED_AMOUNT;
                        return InvoiceLine.query(trx).patchAndFetchById(clone.guid, clone);
                    });

                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(ZERO_MONEY, EXPECTED_AMOUNT, EXPECTED_AMOUNT);
            });

            it('Update', async () =>
            {
                const sourceLine = context.invoiceLines[1];
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        newInvoiceLine.transactionNumber = 'NEWTRX10005';
                        return InvoiceLine.query(trx).patchAndFetchById(newInvoiceLine.guid, newInvoiceLine);
                    });
                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(ZERO_MONEY, sourceLine.amount, sourceLine.amount);
            });

            it('Hard Delete', async () =>
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

                expect(invoiceLine).toBe(undefined);
                await expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });
        });

        describe('CRUD Mulitple Lines', () =>
        {
            it('Expense', async () =>
            {
                const expectFieldsToMatch = expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid);
                const INCOME_AMOUNT = '-4400.56';
                const SUM_AMOUNT = '4400.56';
                const sourceLines = [
                    {
                        invoiceGuid: context.order.invoices[0].guid,
                        amount: '3200.00',
                        itemId: EXPENSE_ID,
                        createdByGuid: SYSTEM_USER
                    },
                    {
                        invoiceGuid: context.order.invoices[0].guid,
                        amount: '1200.56',
                        itemId: EXPENSE_ID,
                        createdByGuid: SYSTEM_USER
                    }
                ];

                let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
                sourceLines[0].guid = invoiceLines[0].guid;
                sourceLines[1].guid = invoiceLines[1].guid;

                const FIND_INVOICELINES = [InvoiceLine.query(trx).findById(sourceLines[0].guid), InvoiceLine.query(trx).findById(sourceLines[1].guid)];
                expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
                expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);

                await expectFieldsToMatch(SUM_AMOUNT, ZERO_MONEY, INCOME_AMOUNT);

                /**
                 *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
                }));

                await expectFieldsToMatch(SUM_AMOUNT, ZERO_MONEY, INCOME_AMOUNT);

                /**
                 *  TEST WITH $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: '1800' });
                }));

                await expectFieldsToMatch('3600.00', ZERO_MONEY, '-3600.00');

                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
                }));

                await expectFieldsToMatch(SUM_AMOUNT, ZERO_MONEY, INCOME_AMOUNT);

                /**
                 *  TEST HARD-DELETING OF THE INVOICE LINES
                 */

                invoiceLines = await InvoiceLine.query(trx)
                    .findByIds([sourceLines[0].guid, sourceLines[1].guid])
                    .delete()
                    .then(() => { return Promise.all(FIND_INVOICELINES); });

                // hard deleted, invoice lines should be gone
                expect(invoiceLines[0]).toBe(undefined);
                expect(invoiceLines[1]).toBe(undefined);

                await expectFieldsToMatch(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });

            it('Revenue', async () =>
            {
                const expectFieldsToMatch = expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid);
                const SUM_AMOUNT = '4400.56';
                const sourceLines = [
                    {
                        invoiceGuid: context.order.invoices[0].guid,
                        amount: '3200.00',
                        itemId: REVENUE_ID,
                        createdByGuid: SYSTEM_USER
                    },
                    {
                        invoiceGuid: context.order.invoices[0].guid,
                        amount: '1200.56',
                        itemId: REVENUE_ID,
                        createdByGuid: SYSTEM_USER
                    }
                ];

                let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
                sourceLines[0].guid = invoiceLines[0].guid;
                sourceLines[1].guid = invoiceLines[1].guid;
                const FIND_INVOICELINES = [InvoiceLine.query(trx).findById(sourceLines[0].guid), InvoiceLine.query(trx).findById(sourceLines[1].guid)];

                expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
                expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);

                await expectFieldsToMatch(ZERO_MONEY, SUM_AMOUNT, SUM_AMOUNT);

                /**
                 *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
                }));

                await expectFieldsToMatch(ZERO_MONEY, SUM_AMOUNT, SUM_AMOUNT);

                /**
                 *  TEST WITH $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: currency(line.amount).add(100).value });
                }));

                const EXPECTED_AMOUNT = currency(sourceLines[0].amount).add(sourceLines[1].amount).add(200).toString();
                await expectFieldsToMatch(ZERO_MONEY, EXPECTED_AMOUNT, EXPECTED_AMOUNT);

                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    // this effectively subtracts 100 because it resets the value to the original
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
                }));

                await expectFieldsToMatch(ZERO_MONEY, SUM_AMOUNT, SUM_AMOUNT);

                /**
                 *  TEST HARD-DELETING OF THE INVOICE LINES
                 */

                invoiceLines = await InvoiceLine.query(trx)
                    .findByIds([sourceLines[0].guid, sourceLines[1].guid])
                    .delete()
                    .then(() => { return Promise.all(FIND_INVOICELINES); });

                expect(invoiceLines[0]).toBe(undefined);
                expect(invoiceLines[1]).toBe(undefined);

                await expectFieldsToMatch(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });

            it('Revenue and Expense', async () =>
            {
                const expectFieldsToMatch = expectOrderFieldsToMatchFactory(trx, context.order.guid, context.job.guid);
                const INCOME_AMOUNT = '1999.44';
                const sourceLines = [
                    {
                        invoiceGuid: context.order.invoices[0].guid,
                        amount: '3200.00',
                        itemId: REVENUE_ID,
                        createdByGuid: SYSTEM_USER
                    },
                    {
                        invoiceGuid: context.order.invoices[0].guid,
                        amount: '1200.56',
                        itemId: EXPENSE_ID,
                        createdByGuid: SYSTEM_USER
                    }
                ];

                let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
                sourceLines[0].guid = invoiceLines[0].guid;
                sourceLines[1].guid = invoiceLines[1].guid;

                const FIND_INVOICELINES = [InvoiceLine.query(trx).findById(sourceLines[0].guid), InvoiceLine.query(trx).findById(sourceLines[1].guid)];

                expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
                expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);

                await expectFieldsToMatch(sourceLines[1].amount, sourceLines[0].amount, INCOME_AMOUNT);

                /**
                 *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
                }));

                await expectFieldsToMatch(sourceLines[1].amount, sourceLines[0].amount, INCOME_AMOUNT);

                /**
                 *  TEST WITH $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: '1800' });
                }));

                await expectFieldsToMatch('1800.00', '1800.00', ZERO_MONEY);

                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    // this effectively subtracts 100 because it resets the value to the original
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
                }));

                await expectFieldsToMatch(sourceLines[1].amount, sourceLines[0].amount, INCOME_AMOUNT);

                /**
                 *  TEST HARD-DELETING OF THE INVOICE LINES
                 */

                invoiceLines = await InvoiceLine.query(trx)
                    .findByIds([sourceLines[0].guid, sourceLines[1].guid])
                    .delete()
                    .then(() => { return Promise.all(FIND_INVOICELINES); });

                expect(invoiceLines[0]).toBe(undefined);
                expect(invoiceLines[1]).toBe(undefined);

                await expectFieldsToMatch(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });

        });

    });

    describe('Bill Lines Only', () =>
    {
        describe('Expense Lines', () =>
        {
            it('Add', async () =>
            {
                const sourceLine = context.billLines[0];
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine);

                expect(invoiceLine.amount).toEqual(sourceLine.amount);
                await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(ZERO_MONEY, sourceLine.amount, sourceLine.amount);
            });

            it('Update Amount', async () =>
            {
                const sourceLine = context.billLines[0];

                // pg returns decimal in string format.
                const EXPECTED_AMOUNT = currency(sourceLine.amount).add(100).toString();
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        newInvoiceLine.amount = EXPECTED_AMOUNT;
                        return InvoiceLine.query(trx)
                            .patchAndFetchById(newInvoiceLine.guid, newInvoiceLine);
                    });

                await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(ZERO_MONEY, EXPECTED_AMOUNT, EXPECTED_AMOUNT);
            });

            it('Update', async () =>
            {
                const sourceLine = context.billLines[0];
                const EXPECTED_AMOUNT = sourceLine.amount;

                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        newInvoiceLine.transactionNumber = 'NEWTRX10005';
                        return InvoiceLine.query(trx).patchAndFetchById(newInvoiceLine.guid, newInvoiceLine);
                    });

                await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(ZERO_MONEY, EXPECTED_AMOUNT, EXPECTED_AMOUNT);
            });

            it('Hard Delete', async () =>
            {
                const sourceLine = context.billLines[0];
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

                expect(invoiceLine).toBe(undefined);
                await await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });
        });

        /**
         *  TESTING REVENUE TYPE INVOICE LINES
         */

        describe('Revenue Lines', () =>
        {
            it('Add', async () =>
            {
                const sourceLine = context.billLines[1];
                const EXPECTED_AMOUNT = sourceLine.amount;
                const NEG_EXPECTED_AMOUNT = currency(0).subtract(EXPECTED_AMOUNT).toString();
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine);

                expect(invoiceLine.amount).toEqual(EXPECTED_AMOUNT);

                await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(EXPECTED_AMOUNT, ZERO_MONEY, NEG_EXPECTED_AMOUNT);
            });

            it('Update Amount', async () =>
            {
                const sourceLine = context.billLines[1];

                // pg returns decimal in string format.
                const EXPECTED_AMOUNT = currency(context.invoiceLines[1].amount).add(100).toString();
                const NEG_EXPECTED_AMOUNT = currency(0).subtract(EXPECTED_AMOUNT).toString();
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        const clone = InvoiceLine.fromJson(newInvoiceLine);
                        clone.amount = EXPECTED_AMOUNT;
                        return InvoiceLine.query(trx).patchAndFetchById(clone.guid, clone);
                    });

                await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(EXPECTED_AMOUNT, ZERO_MONEY, NEG_EXPECTED_AMOUNT);
            });

            it('Update', async () =>
            {
                const sourceLine = context.billLines[1];
                const EXPECTED_AMOUNT = sourceLine.amount;
                const NEG_EXPECTED_AMOUNT = currency(0).subtract(EXPECTED_AMOUNT).toString();
                const invoiceLine = await InvoiceLine.query(trx).insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        newInvoiceLine.transactionNumber = 'NEWTRX10005';
                        return InvoiceLine.query(trx).patchAndFetchById(newInvoiceLine.guid, newInvoiceLine);
                    });

                await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(EXPECTED_AMOUNT, ZERO_MONEY, NEG_EXPECTED_AMOUNT);
            });

            it('Hard Delete', async () =>
            {
                const sourceLine = context.billLines[1];
                const invoiceLine = await InvoiceLine.query(trx)
                    .insert(sourceLine)
                    .then(newInvoiceLine =>
                    {
                        return InvoiceLine.query(trx)
                            .deleteById(newInvoiceLine.guid)
                            .then(() =>
                            {
                                return InvoiceLine.query(trx)
                                    .findById(newInvoiceLine.guid);
                            });
                    });

                expect(invoiceLine).toBe(undefined);
                await expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid)(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });
        });

        /**
         *  TEST REVENUE AND REVENUE INTERACTION WITH ORDER
         */

        describe('CRUD Mulitple Lines', () =>
        {
            /**
             *  TEST EXPENSE INTERACTION WITH ORDER
             *
             *  Expense on Job is opposite (Accounts Receivable)
             *  Revenue on Job is opposite (Accounts Payable)
             */

            it('Expense', async () =>
            {
                const expectFieldsToMatch = expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid);

                const INCOME_AMOUNT = '4400.56';
                const SUM_AMOUNT = '4400.56';
                const sourceLines = [
                    {
                        invoiceGuid: context.order.jobs[0].bills[0].guid,
                        amount: '3200.00',
                        itemId: EXPENSE_ID,
                        createdByGuid: SYSTEM_USER
                    },
                    {
                        invoiceGuid: context.order.jobs[0].bills[0].guid,
                        amount: '1200.56',
                        itemId: EXPENSE_ID,
                        createdByGuid: SYSTEM_USER
                    }
                ];

                let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
                sourceLines[0].guid = invoiceLines[0].guid;
                sourceLines[1].guid = invoiceLines[1].guid;

                const FIND_INVOICELINES = [InvoiceLine.query(trx).findById(sourceLines[0].guid), InvoiceLine.query(trx).findById(sourceLines[1].guid)];

                expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
                expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);

                await expectFieldsToMatch(ZERO_MONEY, SUM_AMOUNT, INCOME_AMOUNT);

                /**
                 *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
                }));

                await expectFieldsToMatch(ZERO_MONEY, SUM_AMOUNT, INCOME_AMOUNT);

                /**
                 *  TEST WITH $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: '1800' });
                }));

                await expectFieldsToMatch(ZERO_MONEY, '3600.00', '3600.00');

                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
                }));

                await expectFieldsToMatch(ZERO_MONEY, SUM_AMOUNT, INCOME_AMOUNT);

                /**
                 *  TEST HARD-DELETING OF THE INVOICE LINES
                 */

                invoiceLines = await InvoiceLine.query(trx)
                    .findByIds([sourceLines[0].guid, sourceLines[1].guid])
                    .delete()
                    .then(() => { return Promise.all(FIND_INVOICELINES); });

                expect(invoiceLines[0]).toBe(undefined);
                expect(invoiceLines[1]).toBe(undefined);
                await expectFieldsToMatch(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });

            it('Revenue', async () =>
            {
                const expectFieldsToMatch = expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid);

                const SUM_AMOUNT = '4400.56';
                const INCOME_AMOUNT = '-4400.56';
                const sourceLines = [
                    {
                        invoiceGuid: context.order.jobs[0].bills[0].guid,
                        amount: '3200.00',
                        itemId: REVENUE_ID,
                        createdByGuid: SYSTEM_USER
                    },
                    {
                        invoiceGuid: context.order.jobs[0].bills[0].guid,
                        amount: '1200.56',
                        itemId: REVENUE_ID,
                        createdByGuid: SYSTEM_USER
                    }
                ];

                let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
                sourceLines[0].guid = invoiceLines[0].guid;
                sourceLines[1].guid = invoiceLines[1].guid;

                const FIND_INVOICELINES = [InvoiceLine.query(trx).findById(sourceLines[0].guid), InvoiceLine.query(trx).findById(sourceLines[1].guid)];

                expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
                expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);

                await expectFieldsToMatch(SUM_AMOUNT, ZERO_MONEY, INCOME_AMOUNT);

                /**
                 *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
                }));

                await expectFieldsToMatch(SUM_AMOUNT, ZERO_MONEY, INCOME_AMOUNT);

                /**
                 *  TEST WITH $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: '1550.23' });
                }));

                await expectFieldsToMatch('3100.46', ZERO_MONEY, '-3100.46');

                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    // this effectively subtracts 100 because it resets the value to the original
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
                }));

                await expectFieldsToMatch(SUM_AMOUNT, ZERO_MONEY, INCOME_AMOUNT);

                /**
                 *  TEST HARD-DELETING OF THE INVOICE LINES
                 */

                invoiceLines = await InvoiceLine.query(trx)
                    .findByIds([sourceLines[0].guid, sourceLines[1].guid])
                    .delete()
                    .then(() => { return Promise.all(FIND_INVOICELINES); });

                expect(invoiceLines[0]).toBe(undefined);
                expect(invoiceLines[1]).toBe(undefined);

                await expectFieldsToMatch(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });

            /**
             *  TEST REVENUE AND EXPENSE INTERACTION WITH ORDER
             */

            it('Revenue and Expense', async () =>
            {
                // function to check if the order finance fields match the job finance fields
                const expectFieldsToMatch = expectFieldsToMatchFactory(trx, context.order.guid, context.order.jobs[0].guid);
                const sourceLines = [
                    {
                        invoiceGuid: context.order.jobs[0].bills[0].guid,
                        amount: '3200.00',
                        itemId: REVENUE_ID,
                        createdByGuid: SYSTEM_USER
                    },
                    {
                        invoiceGuid: context.order.jobs[0].bills[0].guid,
                        amount: '1200.56',
                        itemId: EXPENSE_ID,
                        createdByGuid: SYSTEM_USER
                    }
                ];

                // because this is a bill line, the Revenue and Expense are flipped.
                // Revenue item types are paid out to the vendor (Accounts Payable)
                // Expense item types are recieved from the vendor (Accounts Receivable)
                const INCOME_AMOUNT = '-1999.44';

                let invoiceLines = await InvoiceLine.query(trx).insert(sourceLines);
                sourceLines[0].guid = invoiceLines[0].guid;
                sourceLines[1].guid = invoiceLines[1].guid;

                const FIND_INVOICELINES = [InvoiceLine.query(trx).findById(sourceLines[0].guid), InvoiceLine.query(trx).findById(sourceLines[1].guid)];

                expect(invoiceLines[0].amount).toEqual(sourceLines[0].amount);
                expect(invoiceLines[1].amount).toEqual(sourceLines[1].amount);

                await expectFieldsToMatch(sourceLines[0].amount, sourceLines[1].amount, INCOME_AMOUNT);

                /**
                 *  TEST WITH __NO__ $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    InvoiceLine.query(trx).patchAndFetchById(line.guid, { transactionNumber: 'trx100' });
                }));

                await expectFieldsToMatch(sourceLines[0].amount, sourceLines[1].amount, INCOME_AMOUNT);

                /**
                 *  TEST WITH $$$$ AMOUNT UPDATE
                 */
                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: '1800' });
                }));

                await expectFieldsToMatch('1800.00', '1800.00', ZERO_MONEY);

                invoiceLines = await Promise.all(sourceLines.map(line =>
                {
                    // this effectively subtracts 100 because it resets the value to the original
                    return InvoiceLine.query(trx).patchAndFetchById(line.guid, { amount: line.amount });
                }));

                await expectFieldsToMatch(sourceLines[0].amount, sourceLines[1].amount, INCOME_AMOUNT);

                /**
                 *  TEST HARD-DELETING OF THE INVOICE LINES
                 */

                invoiceLines = await InvoiceLine.query(trx)
                    .findByIds([sourceLines[0].guid, sourceLines[1].guid])
                    .delete()
                    .then(() =>
                    {
                        return Promise.all(FIND_INVOICELINES);
                    });

                expect(invoiceLines[0]).toBe(undefined);
                expect(invoiceLines[1]).toBe(undefined);

                await expectFieldsToMatch(ZERO_MONEY, ZERO_MONEY, ZERO_MONEY);
            });
        });

    });

    describe('Lines With Links', () =>
    {
        describe('Expense Lines', () =>
        {
            it('Adds Link', async () =>
            {
                const sourceBillLine = context.billLines[0];
                const sourceInvoiceLine = context.invoiceLines[0];
                const DIFFERENCE = currency(sourceBillLine.amount).subtract(sourceInvoiceLine.amount).toString();
                const lines = await InvoiceLine.query(trx).insertAndFetch([sourceInvoiceLine, sourceBillLine]);
                const link = await InvoiceLineLink.query(trx).insertAndFetch({
                    line1Guid: lines[0].guid,
                    line2Guid: lines[1].guid
                });
                await expectFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(sourceInvoiceLine.amount, sourceBillLine.amount, DIFFERENCE);
            });

            it('Removes Link', async () =>
            {
                const sourceBillLine = context.billLines[0];
                const sourceInvoiceLine = context.invoiceLines[0];
                const DIFFERENCE = currency(sourceBillLine.amount).subtract(sourceInvoiceLine.amount).toString();
                const lines = await InvoiceLine.query(trx).insertAndFetch([sourceInvoiceLine, sourceBillLine]);
                const link = await InvoiceLineLink.query(trx).insertAndFetch({
                    line1Guid: lines[0].guid,
                    line2Guid: lines[1].guid
                }).then((newLink) =>
                {
                    return InvoiceLineLink.query(trx).where(newLink).delete();
                });
                const [order, job] = await Promise.all([Order.query(trx).findById(context.order.guid), OrderJob.query(trx).findById(context.job.guid)]);

                expect(order.actualExpense).toBe(sourceInvoiceLine.amount);
                expect(order.actualRevenue).toBe(sourceBillLine.amount);
                expect(order.actualIncome).toBe(DIFFERENCE);

                expect(job.actualExpense).toBe(ZERO_MONEY);
                expect(job.actualRevenue).toBe(sourceBillLine.amount);
                expect(job.actualIncome).toBe(sourceBillLine.amount);
            });

            it('Updates Lines', async () =>
            {
                const sourceBillLine = context.billLines[0];
                const sourceInvoiceLine = context.invoiceLines[0];
                const lines = await InvoiceLine.query(trx).insertAndFetch([sourceInvoiceLine, sourceBillLine]);
                const link = await InvoiceLineLink.query(trx).insertAndFetch({
                    line1Guid: lines[0].guid,
                    line2Guid: lines[1].guid
                }).then((newLink) =>
                {
                    return Promise.all([
                        InvoiceLine.query(trx)
                            .findById(lines[0].guid)
                            .patch({ amount: 100 }),
                        InvoiceLine.query(trx)
                            .findById(lines[1].guid)
                            .patch({ amount: 80 })
                    ]);
                });

                await expectFieldsToMatchFactory(trx, context.order.guid, context.job.guid)('100.00', '80.00', '-20.00');
            });
        });

        describe('Revenue Lines', () =>
        {
            it('Adds Link', async () =>
            {
                const sourceBillLine = context.billLines[1];
                const sourceInvoiceLine = context.invoiceLines[1];
                const DIFFERENCE = currency(sourceInvoiceLine.amount).subtract(sourceBillLine.amount).toString();
                const lines = await InvoiceLine.query(trx).insertAndFetch([sourceInvoiceLine, sourceBillLine]);
                const link = await InvoiceLineLink.query(trx).insertAndFetch({
                    line1Guid: lines[0].guid,
                    line2Guid: lines[1].guid
                });
                await expectFieldsToMatchFactory(trx, context.order.guid, context.job.guid)(sourceBillLine.amount, sourceInvoiceLine.amount, DIFFERENCE);
            });

            it('Removes Link', async () =>
            {
                const sourceBillLine = context.billLines[1];
                const sourceInvoiceLine = context.invoiceLines[1];
                const DIFFERENCE = currency(sourceInvoiceLine.amount).subtract(sourceBillLine.amount).toString();
                const lines = await InvoiceLine.query(trx).insertAndFetch([sourceInvoiceLine, sourceBillLine]);
                const link = await InvoiceLineLink.query(trx).insertAndFetch({
                    line1Guid: lines[0].guid,
                    line2Guid: lines[1].guid
                }).then((newLink) =>
                {
                    return InvoiceLineLink.query(trx).where(newLink).delete();
                });
                const [order, job] = await Promise.all([Order.query(trx).findById(context.order.guid), OrderJob.query(trx).findById(context.job.guid)]);

                expect(order.actualExpense).toBe(sourceBillLine.amount);
                expect(order.actualRevenue).toBe(sourceInvoiceLine.amount);
                expect(order.actualIncome).toBe(DIFFERENCE);

                expect(job.actualExpense).toBe(sourceBillLine.amount);
                expect(job.actualRevenue).toBe(ZERO_MONEY);
                expect(job.actualIncome).toBe(currency(0).subtract(sourceBillLine.amount).toString());
            });

            it('Updates Lines', async () =>
            {
                const sourceBillLine = context.billLines[1];
                const sourceInvoiceLine = context.invoiceLines[1];
                const lines = await InvoiceLine.query(trx).insertAndFetch([sourceInvoiceLine, sourceBillLine]);
                const link = await InvoiceLineLink.query(trx).insertAndFetch({
                    line1Guid: lines[0].guid,
                    line2Guid: lines[1].guid
                }).then((newLink) =>
                {
                    return Promise.all([
                        InvoiceLine.query(trx)
                            .findById(lines[0].guid)
                            .patch({ amount: 100 }),
                        InvoiceLine.query(trx)
                            .findById(lines[1].guid)
                            .patch({ amount: 80 })
                    ]);
                });

                await expectFieldsToMatchFactory(trx, context.order.guid, context.job.guid)('80.00', '100.00', '20.00');
            });
        });
    });

});