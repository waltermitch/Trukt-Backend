/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const sinon = require('sinon');
const R = require('ramda');

const Order = require('../../../../../src/Models/Order');
const SFAccount = require('../../../../../src/Models/SFAccount');
const SFContact = require('../../../../../src/Models/SFContact');
const User = require('../../../../../src/Models/User');
const BaseModel = require('../../../../../src/Models/BaseModel');
const OrderStopLink = require('../../../../../src/Models/OrderStopLink');
const InvoiceBill = require('../../../../../src/Models/InvoiceBill');
const Invoice = require('../../../../../src/Models/Invoice');
const Bill = require('../../../../../src/Models/Bill');

const OrderService = require('../../../../../src/Services/OrderService');

const COMMON_DATA = require('./common_data.json');
const SINGLE_JOB_DATA = require('./single_job.json');
const SINGLE_JOB_MULTIPLE_STOPS_DATA = require('./single_job_multiple_stops.json');
const MULTIPLE_RELATED_JOBS_DATA = require('./multiple_related_jobs.json');
const MULTIPLE_UNRELATED_JOBS_DATA = require('./multiple_unrelated_jobs.json');
const MULTIPLE_JOBS_SAME_TERMINALS_DATA = require('./multiple_jobs_same_terminals.json');
const MULTIPLE_JOBS_NO_STOP_CONTACTS_DATA = require('./multiple_jobs_no_stop_contacts.json');

const TEST_CASES = [
    SINGLE_JOB_DATA,
    SINGLE_JOB_MULTIPLE_STOPS_DATA,
    MULTIPLE_RELATED_JOBS_DATA,
    MULTIPLE_UNRELATED_JOBS_DATA,
    MULTIPLE_JOBS_SAME_TERMINALS_DATA,
    MULTIPLE_JOBS_NO_STOP_CONTACTS_DATA
];
let DB_INFORMATION = {};

let controledTransaction;
let stubStartTransaction;
let sandbox;

function completeOrderContacts(templatePayload)
{
    templatePayload.client = { guid: DB_INFORMATION.client.guid };
    templatePayload.consignee = { guid: DB_INFORMATION.client.guid };
    templatePayload.dispatcher = { guid: DB_INFORMATION.user.guid };
    templatePayload.referrer = { guid: DB_INFORMATION.client.guid };
    templatePayload.salesperson = { guid: DB_INFORMATION.client.guid };

    for (const job of templatePayload.jobs)
    {
        job.vendor = { guid: DB_INFORMATION.vendor.guid };
        job.vendorContact = { guid: DB_INFORMATION.contact.guid, name: 'new_test_user' };
        job.vendorAgent = { guid: DB_INFORMATION.contact.guid, name: 'new_test_user' };
        job.dispatcher = { guid: DB_INFORMATION.user.guid };
    }
    return templatePayload;
}

async function fetchOrderGraph(orderCreatedGuid)
{
    const order = await Order.query(controledTransaction).skipUndefined().findById(orderCreatedGuid);
    const orderFetch = await Order.fetchGraph(order, Order.fetch.payload, {
        transaction: controledTransaction,
        skipFetched: true
    }).skipUndefined();

    const terminalCache = {};
    orderFetch.stops = OrderStopLink.toStops(orderFetch.stopLinks);
    delete orderFetch.stopLinks;

    for (const stop of orderFetch.stops)
    {
        if (!(stop.terminal.guid in terminalCache))
            terminalCache[stop.terminal.guid] = stop.terminal;
    }

    delete orderFetch.invoices;
    delete orderFetch.bills;

    for (const job of orderFetch.jobs)
    {
        job.stops = OrderStopLink.toStops(job.stopLinks);
        delete job.stopLinks;

        for (const stop of job.stops)
        {
            if (!(stop.terminal.guid in terminalCache))
                terminalCache[stop.terminal.guid] = stop.terminal;

            for (const commodity of stop.commodities)
            {
                const { amount, link = [] } = job.findInvocieLineByCommodityAndType(commodity.guid, 1);
                commodity.expense = amount || null;
                commodity.revenue = link[0]?.amount || null;
            }
        }

        delete job.bills;
    }
    orderFetch.terminals = Object.values(terminalCache);

    const orderJson = JSON.parse(JSON.stringify(orderFetch));

    for (const job of orderJson.jobs)
    {
        for (let stop of job.stops)
            stop = stop.commodities.sort(customSort(['identifier']));
        job.stops = job.stops.sort(customSort(['sequence']));
    }

    for (let stop of orderJson.stops)
        stop = stop.commodities.sort(customSort(['identifier']));

    orderJson.jobs = orderJson.jobs.sort(customSort(['bol']));
    orderJson.stops = orderJson.stops.sort(customSort(['sequence']));
    orderJson.terminals = orderJson.terminals.sort(customSort(['name']));

    return orderJson;
}

function customSort(paramPath)
{
    return function (object1, object2)
    {
        const field1Value = R.view(R.lensPath(paramPath), object1);
        const field12Value = R.view(R.lensPath(paramPath), object2);
        if (field1Value < field12Value)
            return -1;
        if (field1Value > field12Value)
            return 1;
        return 0;
    };
}

function expectOrderJobContactsToMatch(orderCreated)
{
    expect(orderCreated?.client?.guid).toBe(DB_INFORMATION.client.guid);
    expect(orderCreated?.dispatcher?.guid).toBe(DB_INFORMATION.user.guid);
    expect(orderCreated?.referrer?.guid).toBe(DB_INFORMATION.client.guid);
    expect(orderCreated?.salesperson?.guid).toBe(DB_INFORMATION.client.guid);

    for (const job of orderCreated.jobs)
    {
        expect(job.vendor?.guid).toBe(DB_INFORMATION.vendor.guid);
        expect(job.vendorContact?.guid).toBe(DB_INFORMATION.contact.guid);
        expect(job.vendorAgent?.guid).toBe(DB_INFORMATION.contact.guid);
        expect(job.dispatcher?.guid).toBe(DB_INFORMATION.user.guid);
    }
}

function expectOrderJobStatusToMatch(orderCreated)
{
    expect(typeof orderCreated?.number).toBe('string');
    expect(orderCreated?.status).toBe('new');
    expect(orderCreated?.isReady).toBe(false);
    expect(orderCreated?.isOnHold).toBe(false);
    expect(orderCreated?.isCanceled).toBe(false);
    expect(orderCreated?.isComplete).toBe(false);

    for (const job of orderCreated.jobs)
    {
        expect(job?.number).toEqual(expect.stringContaining(orderCreated?.number));
        expect(job?.status).toBe('new');
        expect(job?.isReady).toBe(false);
        expect(job?.isOnHold).toBe(false);
        expect(job?.isCanceled).toBe(false);
        expect(job?.isComplete).toBe(false);
    }
}

async function queryInvoiceAndBills(orderGuid, jobsGuid)
{
    const orderInvoicesListPromise = InvoiceBill.query(controledTransaction).select('*').whereIn('guid', (
        Invoice.query(controledTransaction).select('invoiceGuid').where('orderGuid', orderGuid)
    ));
    const jobsBillsListPromise = InvoiceBill.query(controledTransaction).select('*').whereIn('guid', (
        Bill.query(controledTransaction).select('billGuid').whereIn('jobGuid', jobsGuid)
    ));

    const [orderInvoicesList, jobsListBills] = await Promise.all([orderInvoicesListPromise, jobsBillsListPromise]);
    const orderInvoicesGraphPromise = InvoiceBill.fetchGraph(orderInvoicesList, { lines: { link: true, item: true } }, { transaction: controledTransaction });
    const jobsBillsGraphPromise = InvoiceBill.fetchGraph(jobsListBills, { job: true, lines: { link: true, item: true } }, { transaction: controledTransaction });

    const [orderInvoices, jobsBills] = await Promise.all([orderInvoicesGraphPromise, jobsBillsGraphPromise]);

    const jobsOrdered = jobsBills.sort(customSort(['job', 'bol']));
    for (const invoice of orderInvoices)
        invoice.lines = invoice.lines.sort(customSort(['amount']));

    return {
        orderInvoices: JSON.parse(JSON.stringify(orderInvoices)),
        jobsBills: JSON.parse(JSON.stringify(jobsOrdered))
    };
}

function completeInformationPayload(orderPayload)
{
    const completeOrder = { ...orderPayload, ...COMMON_DATA.orderInformation };

    for (let job of completeOrder.jobs)
        job = Object.assign(job, COMMON_DATA.jobInformation);

    for (let stop of completeOrder.stops)
        stop = Object.assign(stop, { ...COMMON_DATA.stopInformation, ...stop });

    for (let terminal of completeOrder.terminals)
        terminal = Object.assign(terminal, COMMON_DATA.terminals.find(commonTerminal => commonTerminal.index === terminal.index));

    for (let comodity of completeOrder.commodities)
        comodity = Object.assign(comodity, COMMON_DATA.commodities.find(commonCommodity => commonCommodity.index === comodity.index));

    return completeOrder;
}

describe('Order creation', () =>
{
    beforeAll(async () =>
    {
        const [
            client,
            vendor,
            user,
            contact
        ] = await Promise.all([
            SFAccount.query().modify('byType', 'client').findOne(builder => builder.whereNotNull('guid')),
            SFAccount.query().modify('byType', 'carrier').findOne(builder => builder.whereNotNull('guid')),
            User.query().findOne('name', 'ilike', '%'),
            SFContact.query().findOne('name', 'ilike', '%')
        ]);
        DB_INFORMATION = {
            client,
            vendor,
            user,
            contact,
            sys_user: process.env.SYSTEM_USER
        };
    });

    beforeEach(async () =>
    {
        sandbox = sinon.createSandbox();
        controledTransaction = await BaseModel.startTransaction();
        controledTransaction.commit = async function ()
        {
            return new Promise(resolve => resolve());
        };
        stubStartTransaction = sandbox.stub(BaseModel, 'startTransaction');
        stubStartTransaction.returns(controledTransaction);
    });

    // after each test, rollback all the data that was inserted
    afterEach(async () =>
    {
        await controledTransaction.rollback();
        sandbox.restore();
    });

    afterAll(async () =>
    {
        // close the connection to the database because it will hang otherwise
        BaseModel.knex().destroy();
    });

    for (const TEST of TEST_CASES)
    {
        it(TEST.testName, async () =>
        {
            const orderPayloadWithContacts = completeOrderContacts(TEST.input);
            const completeOrderPayload = completeInformationPayload(orderPayloadWithContacts);
            const orderCreated = await OrderService.create(completeOrderPayload, DB_INFORMATION.sys_user);
            const orderGraph = await fetchOrderGraph(orderCreated.guid);

            const jobsGuid = orderGraph.jobs?.map(job => job.guid);
            const { orderInvoices, jobsBills } = await queryInvoiceAndBills(orderGraph.guid, jobsGuid);

            expect(orderInvoices).toMatchObject(TEST.expectedOutputBills.orderInvoices);
            expect(jobsBills).toMatchObject(TEST.expectedOutputBills.jobsBills);
            expectOrderJobContactsToMatch(orderGraph);
            expectOrderJobStatusToMatch(orderGraph);
            expect(orderGraph).toMatchObject(TEST.expectedOutputGraph);
        });
    }
});