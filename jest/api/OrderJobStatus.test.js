/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */

// Models
const BaseModel = require('../../src/Models/BaseModel');
const SFAccount = require('../../src/Models/SFAccount');
const Order = require('../../src/Models/Order');
const OrderJob = require('../../src/Models/OrderJob');
const LoadboardPost = require('../../src/Models/LoadboardPost');
const LoadboardRequest = require('../../src/Models/LoadboardRequest');
const OrderJobDispatch = require('../../src/Models/OrderJobDispatch');
const Terminal = require('../../src/Models/Terminal');
const OrderStopLink = require('../../src/Models/OrderStopLink');
const OrderStop = require('../../src/Models/OrderStop');
const Commodity = require('../../src/Models/Commodity');

// Extra Data
const data = require('./data.json');

const context = {};
let trx;

function getJob(status)
{
    return OrderJob.query(trx)
        .alias('job')
        .select(
        'job.guid',
        'job.isReady',
        'job.isOnHold',
        'job.isDeleted',
        'job.isCanceled',
        'job.isComplete',
        'typeId',
        'job.vendorGuid',
        'job.vendorAgentGuid')
        .modify(`status${status}`)
        .withGraphFetched('order')
        .modifyGraph('order', builder => builder.select('isTender'))
        .orderBy('job.dateUpdated', 'desc')
        .first();
}

function expectFields(job, isTender, isReady, isOnHold, isDeleted, isCanceled, isCompleted)
{
    expect(job).not.toBeUndefined();
    expect(job).not.toBeNull();
    expect(job.guid).toBe(context.job.guid);
    expect(job.order.isTender).toBe(isTender);
    expect(job.isReady).toBe(isReady);
    expect(job.isOnHold).toBe(isOnHold);
    expect(job.isDeleted).toBe(isDeleted);
    expect(job.isCanceled).toBe(isCanceled);
    expect(job.isComplete).toBe(isCompleted);
}

async function insertStopsAndCommodities()
{
    // insert terminals
    context.terminals = await Terminal.query(trx).insertAndFetch(data.terminals);

    // insert commodities
    context.commodities = await Commodity.query(trx).insertAndFetch(data.commodities);

    const stopPromises = [];
    stopPromises.push(OrderStop.query(trx).insertAndFetch({
        terminalGuid: context.terminals[0].guid,
        stopType: 'pickup',
        createdByGuid: '91c185fd-d33a-4664-95ee-0b7d244fcb4b'
    }));
    stopPromises.push(OrderStop.query(trx).insertAndFetch({
        terminalGuid: context.terminals[1].guid,
        stopType: 'delivery',
        createdByGuid: '91c185fd-d33a-4664-95ee-0b7d244fcb4b'
    }));

    // insert stops
    context.stops = await Promise.all(stopPromises);

    // insert links
    const links = [];
    for(const commodity of context.commodities)
    {
        links.push(OrderStopLink.query(trx).insertAndFetch({
            commodityGuid: commodity.guid,
            orderGuid: context.order.guid,
            jobGuid: null,
            stopGuid: context.stops[0].guid,
            isCompleted: false,
            createdByGuid: '91c185fd-d33a-4664-95ee-0b7d244fcb4b'
        }));

        links.push(OrderStopLink.query(trx).insertAndFetch({
            commodityGuid: commodity.guid,
            orderGuid: context.order.guid,
            jobGuid: context.job.guid,
            stopGuid: context.stops[0].guid,
            isCompleted: false,
            createdByGuid: '91c185fd-d33a-4664-95ee-0b7d244fcb4b'
        }));

        links.push(OrderStopLink.query(trx).insertAndFetch({
            commodityGuid: commodity.guid,
            orderGuid: context.order.guid,
            jobGuid: null,
            stopGuid: context.stops[1].guid,
            isCompleted: false,
            createdByGuid: '91c185fd-d33a-4664-95ee-0b7d244fcb4b'
        }));

        links.push(OrderStopLink.query(trx).insertAndFetch({
            commodityGuid: commodity.guid,
            orderGuid: context.order.guid,
            jobGuid: context.job.guid,
            stopGuid: context.stops[1].guid,
            isCompleted: false,
            createdByGuid: '91c185fd-d33a-4664-95ee-0b7d244fcb4b'
        }));
    }

    context.links = await Promise.all(links);
}
describe('Status verification', () =>
{
    beforeEach(async () =>
    {
        trx = await BaseModel.startTransaction();

        const client = await SFAccount.query(trx).insertAndFetch({ name: 'Integration Test Client' });

        const order = Order.fromJson({
            clientGuid: client.guid,
            referenceNumber: 'TEST',
            status: 'new',
            isTender: false
        });
        const job = OrderJob.fromJson({
            isTransport: true,
            typeId: 1
        });
        order.setCreatedBy(process.env.SYSTEM_USER);
        job.setCreatedBy(process.env.SYSTEM_USER);
        order.jobs = [job];
        context.client = client;
        context.order = await Order.query(trx).insertGraphAndFetch(order, { relate: true });
        context.job = order.jobs[0];
    });

    afterEach(async () =>
    {
        await trx.rollback();
    });

    afterAll(async () =>
    {
        // close the connection to the database because it will hang otherwise
        BaseModel.knex().destroy();
    });

    it('Job is new', async () =>
    {
        // query for job data with filter
        const resJob = await getJob('New');

        // assert
        expectFields(resJob, false, false, false, false, false, false);

    });

    it('Order is Tender', async () =>
    {
        // set the order to meet tender conditions
        await Order.query(trx).patch({ isTender: true }).findById(context.order.guid);

        // query for job data with filter
        const resJob = await getJob('Tender');

        // assert
        expectFields(resJob, true, false, false, false, false, false);
    });

    it('Job is Ready', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({ isReady: true }).findById(context.job.guid);

        // get data
        const resJob = await getJob('Ready');

        // assert
        expectFields(resJob, false, true, false, false, false, false);
    });

    it('Job is On Hold', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({ isOnHold: true }).findById(context.job.guid);

        // get data
        const resJob = await getJob('OnHold');

        // assert
        expectFields(resJob, false, false, true, false, false, false);
    });

    it('Job is Posted', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({ isReady: true }).findById(context.job.guid);
        await LoadboardPost.query(trx)
        .insert({
            jobGuid: context.job.guid,
            loadboard: 'SUPERDISPATCH',
            isPosted: true,
            createdByGuid: process.env.SYSTEM_USER
        });

        // get data
        const query = getJob('Posted').withGraphFetched('loadboardPosts');
        const resJob = await query;

        // assert
        expectFields(resJob, false, true, false, false, false, false);
        expect(resJob.loadboardPosts[0].isPosted).toBe(true);
        expect(resJob.vendorGuid).toBeNull();
    });

    it('Job Is Requested', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({ isReady: true }).findById(context.job.guid);
        const post = await LoadboardPost.query(trx)
        .insertAndFetch({
            jobGuid: context.job.guid,
            loadboard: 'SUPERDISPATCH',
            isPosted: true,
            createdByGuid: process.env.SYSTEM_USER
        });
        await LoadboardRequest.query(trx)
        .insert({
            status: 'lmao',
            price: 420.69,
            loadboard: post.loadboard,
            loadboardPostGuid: post.guid,
            isValid: true,
            createdByGuid: process.env.SYSTEM_USER
        });

        // get data
        const query = getJob('Posted').withGraphFetched('[loadboardPosts.requests]');
        const resJob = await query;

        // assert
        expectFields(resJob, false, true, false, false, false, false);
        expect(resJob.loadboardPosts[0].isPosted).toBe(true);
        expect(resJob.loadboardPosts[0].requests[0].isValid).toBe(true);
        expect(resJob.vendorGuid).toBeNull();
    });

    it('Job is Pending', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({ isReady: true }).findById(context.job.guid);
        await OrderJobDispatch.query(trx).insert({
            jobGuid: context.job.guid,

            // making the client the vendor cause I don't care
            vendorGuid: context.client.guid,
            isPending: true,
            createdByGuid: process.env.SYSTEM_USER
        });

        // get data
        const query = getJob('Pending').withGraphFetched('[dispatches]');
        const resJob = await query;

        // assert
        expectFields(resJob, false, true, false, false, false, false);
        expect(resJob.dispatches[0].isPending).toBe(true);
        expect(resJob.dispatches[0].vendorGuid).toBe(context.client.guid);
        expect(resJob.vendorGuid).toBeNull();
    });

    it('Job is Declined', async () =>
{
        // set data
        await OrderJob.query(trx).patch({ isReady: true }).findById(context.job.guid);
        await OrderJobDispatch.query(trx).insert({
            jobGuid: context.job.guid,

            // making the client the vendor cause I don't care
            vendorGuid: context.client.guid,
            isPending: false,
            isDeclined: true,
            createdByGuid: process.env.SYSTEM_USER
        });

        // get data
        const query = getJob('Declined').withGraphFetched('[dispatches]');
        const resJob = await query;

        // assert
        expectFields(resJob, false, true, false, false, false, false);
        expect(resJob.dispatches[0].isPending).toBe(false);
        expect(resJob.dispatches[0].isDeclined).toBe(true);
        expect(resJob.dispatches[0].vendorGuid).toBe(context.client.guid);
        expect(resJob.vendorGuid).toBeNull();
    });

    it('Job is Dispatched', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isReady: true })
            .findById(context.job.guid);
        await OrderJobDispatch.query(trx).insert({
            jobGuid: context.job.guid,

            // making the client the vendor cause I don't care
            vendorGuid: context.client.guid,
            isPending: false,
            isDeclined: false,
            isAccepted: true,
            createdByGuid: process.env.SYSTEM_USER
        });

        // get data
        const query = getJob('Dispatched').withGraphFetched('[dispatches]');
        const resJob = await query;

        // assert
        expectFields(resJob, false, true, false, false, false, false);
        expect(resJob.dispatches[0].isPending).toBe(false);
        expect(resJob.dispatches[0].isDeclined).toBe(false);
        expect(resJob.dispatches[0].vendorGuid).toBe(context.client.guid);
        expect(resJob.vendorGuid).toBe(context.client.guid);
    });

    it('Job is Picked Up', async () =>
    {
        await insertStopsAndCommodities();

        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isReady: true })
            .findById(context.job.guid);
        
        // mark all pickups as completed
        await OrderStopLink.query(trx).patch({ isCompleted: true }).where({ stopGuid: context.stops[0].guid });

        // get data
        const query = getJob('PickedUp').withGraphFetched('[commodities]');
        const resJob = await query;

        // assert
        expectFields(resJob, false, true, false, false, false, false);
        expect(resJob.vendorGuid).toBe(context.client.guid);
    });

    it('Job is Delivered', async () =>
    {
        await insertStopsAndCommodities();

        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isReady: true })
            .findById(context.job.guid);

        // mark all deliveries as completed
        await OrderStopLink.query(trx).patch({ isCompleted: true }).where({ stopGuid: context.stops[1].guid });

        // get data
        const query = getJob('Delivered').withGraphFetched('[commodities]');
        const resJob = await query;

        // assert
        expectFields(resJob, false, true, false, false, false, false);
        expect(resJob.vendorGuid).toBe(context.client.guid);
    });

    it('Job is Completed', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isComplete: true })
            .findById(context.job.guid);
        
        // get data
        const resJob = await getJob('Complete');

        // assert
        expectFields(resJob, false, false, false, false, false, true);
    });

    it('Job is Canceled', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isCanceled: true })
            .findById(context.job.guid);

        // get data
        const resJob = await getJob('Canceled');

        // assert
        expectFields(resJob, false, false, false, false, true, false);
    });

    it('Job is Deleted', async () =>
    {
        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isDeleted: true })
            .findById(context.job.guid);

        // get data
        const resJob = await getJob('Deleted');

        // assert
        expectFields(resJob, false, false, false, true, false, false);
    });

    it('Job is Not Picked Up', async () =>
    {
        await insertStopsAndCommodities();

        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isReady: true })
            .findById(context.job.guid);
        
        // mark most pickups as completed except for the first link which should be a pickup link
        await OrderStopLink.query(trx).patch({ isCompleted: true }).where({ stopGuid: context.stops[0].guid }).whereNot({ id: context.links[0].id });

        // get data
        const resJob = await getJob('PickedUp');

        // assert
        expect(resJob).toBeUndefined();
    });

    it('Job is Not Delivered', async () =>
    {
        await insertStopsAndCommodities();

        // set data
        await OrderJob.query(trx).patch({
            vendorGuid: context.client.guid,
            isReady: true })
            .findById(context.job.guid);
        
        // mark most deliveries as completed except for the first link which should be a delivery link
        await OrderStopLink.query(trx).patch({ isCompleted: true }).where({ stopGuid: context.stops[1].guid }).whereNot({ id: context.links[context.links.length - 1].id });

        // get data
        const resJob = await getJob('Delivered');

        // assert
        expect(resJob).toBeUndefined();
    });

});

describe('Exception Handling', () =>
{
    beforeEach(async () =>
    {
        trx = await BaseModel.startTransaction();

        const client = await SFAccount.query(trx).insertAndFetch({ name: 'Integration Test Client' });

        const order = Order.fromJson({
            clientGuid: client.guid,
            referenceNumber: 'TEST',
            status: 'new',
            isTender: false
        });
        const job = OrderJob.fromJson({
            isTransport: true,
            typeId: 1
        });
        order.setCreatedBy(process.env.SYSTEM_USER);
        job.setCreatedBy(process.env.SYSTEM_USER);
        order.jobs = [job];
        context.client = client;
        context.order = await Order.query(trx).insertGraphAndFetch(order, { relate: true });
        context.job = order.jobs[0];
    });

    afterEach(async () =>
    {
        await trx.rollback();
    });

    afterAll(async () =>
    {
        // close the connection to the database because it will hang otherwise
        BaseModel.knex().destroy();
    });

    it('Job is Ready And Canceled', async () =>
    {
        try
        {
            await OrderJob.query(trx).patch({
                vendorGuid: context.client.guid,
                isReady: true,
                isCanceled: true
            }).findById(context.job.guid);
        }
        catch(e)
        {
            expect(e.toString()).toContain(data.orderJobsReadyConstraintError);
        }
    });

    it('Job is Complete and Canceled', async () =>
    {
        try
        {
            await OrderJob.query(trx).patch({
                vendorGuid: context.client.guid,
                isComplete: true,
                isOnHold: true,
                isCanceled: true
            }).findById(context.job.guid);
        }
        catch(e)
        {
            console.log(e.toString());
            expect(e.toString()).toContain(data.orderJobsCancelConstraintError);
        }
    });

    it('Job is Complete and On Hold', async () =>
    {
        try
        {
            await OrderJob.query(trx).patch({
                vendorGuid: context.client.guid,
                isComplete: true,
                isOnHold: true
            }).findById(context.job.guid);
        }
        catch(e)
        {
            console.log(e.toString());
            expect(e.toString()).toContain(data.orderJobsCompleteContstraintError);
        }
    });

});