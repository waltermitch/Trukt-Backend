/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const SFAccount = require('../../../src/Models/SFAccount');
const SFRecordType = require('../../../src/Models/SFRecordType');
const Order = require('../../../src/Models/Order');
const OrderJob = require('../../../src/Models/OrderJob');
const OrderJobType = require('../../../src/Models/OrderJobType');
const LineItem = require('../../../src/Models/InvoiceLineItem');
const InvoiceBill = require('../../../src/Models/InvoiceBill');
const InvoiceLine = require('../../../src/Models/InvoiceLine');
const Bill = require('../../../src/Models/Bill');
const Invoice = require('../../../src/Models/Invoice');
const InvoiceLineLink = require('../../../src/Models/InvoiceLineLink');
const BaseModel = require('../../../src/Models/BaseModel');

// this is an integration test/functional test, meaning this tests
// how everything works together along with the db triggers
// in order to calculate the right actual money field values
describe('Tests the invoice line and and invoice line links triggers', () =>
{
    const context = {};
    let trx;

    beforeEach(async () =>
    {
        trx = await BaseModel.startTransaction();

        // data setup
        const rt = await SFRecordType.query(trx).select().modify('byType', 'Account').modify('byName', 'Client');
        const clientModel = SFAccount.fromJson({
            name: 'Integration Test Client',
            recordTypeId: rt.sfId,
            accountSource: 'Integration Test',
            description: 'This client is from an integration test, if you find this client in a live environment, please delete'
        });
        const client = await SFAccount.query(trx).insertAndFetch(clientModel);
        const lineItems = [{ id: 1000, name: 'test revenue line item', type: 'revenue' }, { id: 1001, name: 'test expense line item', type: 'expense' }];
        await LineItem.query(trx).insertAndFetch(lineItems);
        const jobTypes = await OrderJobType.query(trx);

        const orderObj = Order.fromJson({
            createdByGuid: process.env.SYSTEM_USER,
            referenceNumber: 'test',
            clientGuid: client.guid,
            actualRevenue: 0,
            actualExpense: 0,
            estimatedRevenue: 0,
            estimatedExpense: 0,
            jobs: [
                {
                    index: 'job_1',
                    createdByGuid: process.env.SYSTEM_USER,
                    actualRevenue: 0,
                    actualExpense: 0,
                    estimatedRevenue: 0,
                    estimatedExpense: 0,
                    isTransport: true,
                    isDeleted: false,
                    isStarted: false,
                    'category': 'transport',
                    'type': 'transport'
                }
            ]
        });
        const jobType = jobTypes.find(it => OrderJobType.compare(orderObj.jobs[0], it));
        orderObj.jobs[0].graphLink('jobType', jobType);
        orderObj.jobs[0].setIsTransport(jobType);
        const order = await Order.query(trx).skipUndefined()
                    .insertGraph(orderObj, {
                        allowRefs: true
                    }).returning('guid');
        const invoices = [
            // invoice
            {
                isSyncedExternalSource: false,
                referenceNumber: 'DELETE ME',
                isValid: true,
                isGenerated: false,
                isPaid: false,
                isInvoice: true,
                createdByGuid: process.env.SYSTEM_USER,
                externalSource: 'test invoice'
            },
    
            // bill
            {
                isSyncedExternalSource: false,
                referenceNumber: 'DELETE ME',
                isValid: true,
                isGenerated: false,
                isPaid: false,
                isInvoice: false,
                createdByGuid: process.env.SYSTEM_USER,
                externalSource: 'test bill'
            }
        ];
        const [ invoice, bill ] = await InvoiceBill.query(trx).insertAndFetch(invoices);
        context.invoice = invoice;
        context.bill = bill;
        await Invoice.query(trx).insert({ invoiceGuid: invoice.guid, orderGuid: order.guid });
        await Bill.query(trx).insert({ billGuid: bill.guid, jobGuid: order.jobs[0].guid });
        const invoiceLines = [
            {
                notes: 'this is for test purposes, please delete if found in db',
                invoiceGuid: invoice.guid,
                amount: 54,
                itemId: 1000,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            },
            {
                notes: 'this is for test purposes, please delete if found in db',
                invoiceGuid: invoice.guid,
                amount: 66,
                itemId: 1000,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            }
        ];
        const billLines = [
            {
                notes: 'this is for test purposes, please delete if found in db',
                invoiceGuid: bill.guid,
                amount: 45,
                itemId: 1000,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            },
            {
                notes: 'this is for test purposes, please delete if found in db',
                invoiceGuid: bill.guid,
                amount: 55,
                itemId: 1000,
                isDeleted: false,
                createdByGuid: process.env.SYSTEM_USER
            }
        ];

        context.invoiceBillLines = (await InvoiceLine.query(trx)
        .insertAndFetch([...invoiceLines, ...billLines]))
        .map(line => { return line.guid; });

        context.order = order;
    });

    const insertLinks = async () =>
    {
        await InvoiceLineLink.query(trx).insert({ line1Guid: context.invoiceBillLines[2], line2Guid: context.invoiceBillLines[0] });

        await InvoiceLineLink.query(trx).insert({ line1Guid: context.invoiceBillLines[3], line2Guid: context.invoiceBillLines[1] });
    };

    const deleteLinks = async() =>
    {
        await InvoiceLineLink.query(trx).delete().whereIn('line1Guid', context.invoiceBillLines);
    };

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

    it('Tests the actual money fields on line inserts', async () =>
    {
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('120.00');
        expect(getOrder.actualExpense).toBe('100.00');
        expect(getOrder.actualIncome).toBe('20.00');

        expect(getJob.actualRevenue).toBe('0.00');
        expect(getJob.actualExpense).toBe('100.00');
        expect(getJob.actualIncome).toBe('-100.00');
           
    });

     it('Tests the actual money fields on line hard deletes', async () =>
    {
        // deleting specific order invoice line
        await InvoiceLine.query(trx).delete().where({ invoiceGuid: context.invoice.guid, amount: 54 });

        // deleting specific job bill line
        await InvoiceLine.query(trx).delete().where({ invoiceGuid: context.bill.guid, amount: 55 });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('66.00');
        expect(getOrder.actualExpense).toBe('45.00');
        expect(getOrder.actualIncome).toBe('21.00');

        expect(getJob.actualRevenue).toBe('0.00');
        expect(getJob.actualExpense).toBe('45.00');
        expect(getJob.actualIncome).toBe('-45.00');
            
    });

    it('Tests the actual money fields on line updates', async () =>
    {
        // difference is 54 -> 65 = 11
        await InvoiceLine.query(trx).patch({ amount: 65 }).where({ guid: context.invoiceBillLines[0] });

        // deleting specific job bill line
        // difference is 45 -> 23 = 22
        await InvoiceLine.query(trx).patch({ amount: 23 }).where({ guid: context.invoiceBillLines[2] });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('131.00');
        expect(getOrder.actualExpense).toBe('78.00');
        expect(getOrder.actualIncome).toBe('53.00');

        expect(getJob.actualRevenue).toBe('0.00');
        expect(getJob.actualExpense).toBe('78.00');
        expect(getJob.actualIncome).toBe('-78.00');
    });

     it('Tests the actual money fields on line soft deletes', async () =>
    {
        // action
        // soft delete invoice line
        await InvoiceLine.query(trx).patch({ isDeleted: true })
        .where({ guid: context.invoiceBillLines[0] });

        // soft delete bill line
        await InvoiceLine.query(trx).patch({ isDeleted: true })
        .where({ guid: context.invoiceBillLines[2] });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('66.00');
        expect(getOrder.actualExpense).toBe('55.00');
        expect(getOrder.actualIncome).toBe('11.00');

        expect(getJob.actualRevenue).toBe('0.00');
        expect(getJob.actualExpense).toBe('55.00');
        expect(getJob.actualIncome).toBe('-55.00');
    });

    it('Tests the actual money fields on line soft undeletes', async () =>
    {
        // action
        // soft delete invoice line
        await InvoiceLine.query(trx).patch({ isDeleted: true })
        .where({ guid: context.invoiceBillLines[0] });

        // soft delete bill line
        await InvoiceLine.query(trx).patch({ isDeleted: true })
        .where({ guid: context.invoiceBillLines[2] });

        // soft undelete invoice line
        await InvoiceLine.query(trx).patch({ isDeleted: false })
        .where({ guid: context.invoiceBillLines[0] });

        // soft undelete bill line
        await InvoiceLine.query(trx).patch({ isDeleted: false })
        .where({ guid: context.invoiceBillLines[2] });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('120.00');
        expect(getOrder.actualExpense).toBe('100.00');
        expect(getOrder.actualIncome).toBe('20.00');

        expect(getJob.actualRevenue).toBe('0.00');
        expect(getJob.actualExpense).toBe('100.00');
        expect(getJob.actualIncome).toBe('-100.00');
    });
    it('Tests the order job actual expense fields on adding line links', async () =>
    {
        await InvoiceLineLink.query(trx).insert({ line1Guid: context.invoiceBillLines[2], line2Guid: context.invoiceBillLines[0] });

        await InvoiceLineLink.query(trx).insert({ line1Guid: context.invoiceBillLines[3], line2Guid: context.invoiceBillLines[1] });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('120.00');
        expect(getOrder.actualExpense).toBe('100.00');
        expect(getOrder.actualIncome).toBe('20.00');

        expect(getJob.actualRevenue).toBe('120.00');
        expect(getJob.actualExpense).toBe('100.00');
        expect(getJob.actualIncome).toBe('20.00');
    });

    it('Tests the order job actual expense fields when deleting line links', async () =>
    {
        await insertLinks();
        await deleteLinks();

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('120.00');
        expect(getOrder.actualExpense).toBe('100.00');
        expect(getOrder.actualIncome).toBe('20.00');

        expect(getJob.actualRevenue).toBe('0.00');
        expect(getJob.actualExpense).toBe('100.00');
        expect(getJob.actualIncome).toBe('-100.00');
    });

    it('Tests the order job actual expense fields when inserting expense lines', async () =>
    {
        await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.bill.guid,
            amount: 18,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });
        
        await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.invoice.guid,
            amount: 25,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('138.00');
        expect(getOrder.actualExpense).toBe('125.00');
        expect(getOrder.actualIncome).toBe('13.00');

        expect(getJob.actualRevenue).toBe('18.00');
        expect(getJob.actualExpense).toBe('100.00');
        expect(getJob.actualIncome).toBe('-82.00');
    });

    it('Tests the order job actual expense fields when deleting expense lines', async () =>
    {
        await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.bill.guid,
            amount: 18,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });
        
        await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.invoice.guid,
            amount: 25,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });

        await InvoiceLine.query(trx).delete().where({ itemId: 1001 });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('120.00');
        expect(getOrder.actualExpense).toBe('100.00');
        expect(getOrder.actualIncome).toBe('20.00');

        expect(getJob.actualRevenue).toBe('0.00');
        expect(getJob.actualExpense).toBe('100.00');
        expect(getJob.actualIncome).toBe('-100.00');
    });

    it('Tests the order job actual expense fields when updating expense lines', async () =>
    {
        await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.bill.guid,
            amount: 18,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });
        
        await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.invoice.guid,
            amount: 25,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });

        await InvoiceLine.query(trx).patch({ amount: 22 }).where({ itemId: 1001 });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('142.00');
        expect(getOrder.actualExpense).toBe('122.00');
        expect(getOrder.actualIncome).toBe('20.00');

        expect(getJob.actualRevenue).toBe('22.00');
        expect(getJob.actualExpense).toBe('100.00');
        expect(getJob.actualIncome).toBe('-78.00');
    });

    it('Tests the order job actual expense fields when creating a link between an order and a job expense', async () =>
    {
        const be = await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.bill.guid,
            amount: 18,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });
        
        const ie = await InvoiceLine.query(trx).insert({
            notes: 'this is for test purposes, please delete if found in db',
            invoiceGuid: context.invoice.guid,
            amount: 25,
            itemId: 1001,
            isDeleted: false,
            createdByGuid: process.env.SYSTEM_USER
        });

        await InvoiceLineLink.query(trx).insert({ line1Guid: be.guid, line2Guid: ie.guid });

        // retrieving order and job from the db
        const getOrder = await Order.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.guid);
        const getJob = await OrderJob.query(trx)
        .select('actualRevenue', 'actualExpense', 'actualIncome')
        .findById(context.order.jobs[0].guid);

        // assert
        expect(getOrder.actualRevenue).toBe('138.00');
        expect(getOrder.actualExpense).toBe('125.00');
        expect(getOrder.actualIncome).toBe('13.00');

        expect(getJob.actualRevenue).toBe('18.00');
        expect(getJob.actualExpense).toBe('125.00');
        expect(getJob.actualIncome).toBe('-107.00');
    });
});