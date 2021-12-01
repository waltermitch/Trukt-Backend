/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const OrderService = require('../../src/Services/OrderService');
const BaseModel = require('../../src/Models/BaseModel');
const SFAccount = require('../../src/Models/SFAccount');
const Order = require('../../src/Models/Order');
const OrderJob = require('../../src/Models/OrderJob');
const { expectation } = require('sinon');
const LoadboardPost = require('../../src/Models/LoadboardPost');
const LoadboardRequest = require('../../src/Models/LoadboardRequest');
const OrderJobDispatch = require('../../src/Models/OrderJobDispatch');

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
    });
});