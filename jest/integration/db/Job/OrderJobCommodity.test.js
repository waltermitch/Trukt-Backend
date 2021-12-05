/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */

const { count, exit } = require('yargs');
const BaseModel = require('../../../../src/Models/BaseModel');
const Commodity = require('../../../../src/Models/Commodity');
const Order = require('../../../../src/Models/Order');
const OrderJob = require('../../../../src/Models/OrderJob');
const OrderStop = require('../../../../src/Models/OrderStop');
const OrderStopLink = require('../../../../src/Models/OrderStopLink');
const SFAccount = require('../../../../src/Models/SFAccount');
const Terminal = require('../../../../src/Models/Terminal');
const OrderJobService = require('../../../../src/Services/OrderJobService');

let context;
let trx;

describe('Delete Commodity From Jobs', () =>
{
    beforeEach(async () =>
    {
        trx = await BaseModel.startTransaction();
        context = {};
        let orders = [];
        for (let orderNo = 0; orderNo < 2; orderNo++)
        {
            const order = Order.fromJson({ client: SFAccount.fromJson({ name: 'Fake Client' }) });
            const job = OrderJob.fromJson({ jobType: { '#dbRef': 1 }, isTransport: true });

            order.setCreatedBy(process.env.SYSTEM_USER);
            job.setCreatedBy(process.env.SYSTEM_USER);
            order.jobs = [job, OrderJob.fromJson(job)];
            orders.push(order);
        }

        let commodities = [];
        let stops = [];

        for (let i = 0; i < 6; i++)
        {
            const comm = Commodity.fromJson({});
            comm.setCreatedBy(process.env.SYSTEM_USER);
            commodities.push(comm);
        }
        for (let i = 0; i < 6; i++)
        {
            const terminal = Terminal.fromJson({ name: 'Fake Terminal', street1: 'test' + i, zipCode: 12345 });
            terminal.setCreatedBy(process.env.SYSTEM_USER);
            const stop = OrderStop.fromJson({
                terminal
            });
            stop.setCreatedBy(process.env.SYSTEM_USER);
            stops.push(stop);
        }

        [orders, commodities, stops] = await Promise.all([Order.query(trx).insertGraphAndFetch(orders, { allowRefs: true }), Commodity.query(trx).insertGraphAndFetch(commodities), OrderStop.query(trx).insertGraphAndFetch(stops)]);
        context = { orders, commodities, stops };

        const stopLinks = [];
        commodities = commodities.slice(0, commodities.length);
        stops = stops.slice(0, stops.length);

        // Create orders that have 2 jobs each, where the commodities are transported across two legs.
        for (const order of orders)
        {
            const comms = commodities.splice(0, 3);
            const orderStops = [stops.slice(0, 2), stops.slice(1, 3)];
            const orderVisibleStops = stops.splice(0, 3);

            for (const com of comms)
            {
                // create stops for only the first and last stop on the order.
                // All the other stops in between are job only stops.
                for (const index of [0, 2])
                {
                    const orderLink = OrderStopLink.fromJson({
                        orderGuid: order.guid,
                        commodityGuid: com.guid,
                        stopGuid: orderVisibleStops[index].guid
                    });
                    orderLink.setCreatedBy(process.env.SYSTEM_USER);
                    stopLinks.push(orderLink);
                }
            }

            for (const job of order.jobs)
            {
                const jobStops = orderStops.shift();
                for (const com of comms)
                {

                    for (const stop of jobStops)
                    {
                        const jobLink = OrderStopLink.fromJson({
                            orderGuid: order.guid,
                            jobGuid: job.guid,
                            commodityGuid: com.guid,
                            stopGuid: stop.guid
                        });
                        jobLink.setCreatedBy(process.env.SYSTEM_USER);
                        stopLinks.push(jobLink);
                    }
                }
            }
        }

        await OrderStopLink.query(trx).insert(stopLinks);

    });

    afterEach(async () =>
    {
        await trx.rollback();
    });

    afterAll(async () =>
    {
        BaseModel.knex().destroy();
    });

    test('One Commodity', async () =>
    {
        const commGuids = context.commodities.slice(0, 1).map(it => it.guid);
        await OrderJobService.deleteCommodities(context.orders[0].guid, context.orders[0].jobs[0].guid, commGuids, trx);

        const [
            order1Links,
            job1Links,
            job2Links,
            order2Links
        ] = await Promise.all([
            // all the commodity links to the order
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .whereNull('jobGuid')
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the job only
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .where('jobGuid', context.orders[0].jobs[0].guid)
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the other Order's Job
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .where('jobGuid', context.orders[0].jobs[1].guid)
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the other Order
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[1].guid)

        ]);

        expect(order1Links.length).toBe(1);
        expect(job1Links.length).toBe(0);
        expect(job2Links.length).toBe(2);
        expect(order2Links.length).toBe(18);
    });

    test('Two Commodities', async () =>
    {
        const commGuids = context.commodities.slice(0, 2).map(it => it.guid);
        await OrderJobService.deleteCommodities(context.orders[0].guid, context.orders[0].jobs[0].guid, commGuids, trx);

        const [
            order1Links,
            job1Links,
            job2Links,
            order2Links
        ] = await Promise.all([
            // all the commodity links to the order
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .whereNull('jobGuid')
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the job only
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .where('jobGuid', context.orders[0].jobs[0].guid)
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the other Order's Job
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .where('jobGuid', context.orders[0].jobs[1].guid)
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the other Order
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[1].guid)

        ]);

        expect(order1Links.length).toBe(2);
        expect(job1Links.length).toBe(0);
        expect(job2Links.length).toBe(4);
        expect(order2Links.length).toBe(18);
    });

    test('All Commodities', async () =>
    {
        const commGuids = context.commodities.slice(0, 3).map(it => it.guid);
        await OrderJobService.deleteCommodities(context.orders[0].guid, context.orders[0].jobs[0].guid, commGuids, trx);

        const [
            order1Links,
            job1Links,
            job2Links,
            order2Links,
            stop1
        ] = await Promise.all([
            // all the commodity links to the order
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .whereNull('jobGuid')
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the job only
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .where('jobGuid', context.orders[0].jobs[0].guid)
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the other Order's Job
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[0].guid)
                .where('jobGuid', context.orders[0].jobs[1].guid)
                .whereIn('commodityGuid', commGuids),

            // all the commodity links to the other Order
            OrderStopLink.query(trx)
                .where('orderGuid', context.orders[1].guid),

            OrderStop.query(trx).findById(context.stops[0].guid)

        ]);

        expect(order1Links.length).toBe(3);
        expect(job1Links.length).toBe(0);
        expect(job2Links.length).toBe(6);
        expect(order2Links.length).toBe(18);
        expect(stop1).toBeUndefined();
    });

});
