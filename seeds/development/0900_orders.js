const Order = require('../../src/Models/Order');
const OrderJob = require('../../src/Models/OrderJob');
const OrderJobType = require('../../src/Models/OrderJobType');
const OrderStop = require('../../src/Models/OrderStop');
const OrderStopLink = require('../../src/Models/OrderStopLink');
const Terminal = require('../../src/Models/Terminal');
const Vehicle = require('../../src/Models/Vehicle');
const Commodity = require('../../src/Models/Commodity');
const SFAccount = require('../../src/Models/SFAccount');
const migration_tools = require('../../tools/migration');
const faker = require('faker');
const Enums = require('../../src/Models/Enums');
const { DateTime } = require('luxon');

function stopsDates()
{
    const now = DateTime.now();
    const dates = {
        pickup: {},
        delivery: {}
    };
    dates.pickup.start = DateTime.local(now.year, now.month + 1, faker.datatype.number(27) + 1, faker.datatype.number(23), faker.datatype.number(59));
    dates.delivery.start = dates.pickup.start.plus({ days: faker.datatype.number(7) + 14 });
    dates.pickup.end = dates.pickup.start.plus({ days: faker.datatype.number(3) + 2 });
    dates.delivery.end = dates.delivery.start.plus({ days: faker.datatype.number(3) + 2 });
    return dates;
}

exports.seed = async function (knex)
{
    return knex.transaction(async (trx) =>
    {
        const createdBy = '00000000-0000-0000-0000-000000000000';
        const capacityTypes = await new Enums(trx).select('load_capacity_types');
        const dateTypes = await new Enums(trx).select('date_schedule_types');
        const ternaryOptions = migration_tools.ternary_options;
        const vehicles = await Vehicle.query(trx).limit(10);
        const vehicleTypes = await trx.select('id').from('rcg_tms.commodity_types');
        const transportJobType = await OrderJobType.query(trx).findOne('category', 'transport');
        const terminals = await Terminal.query(trx);
        const clients = await SFAccount.query(trx).modify('byType', 'client').limit(1);

        const carrierPay = 1000;
        const tariff = 1200;

        const client = clients[0];
        const order = await Order.query(trx).insertAndFetch({
            status: 'new',
            clientGuid: client.guid,
            isDummy: false,
            instructions: faker.lorem.words(60),
            estimatedExpense: carrierPay,
            estimatedRevenue: tariff,
            referenceNumber: faker.lorem.word().toUpperCase().substring(0, 5).padEnd(5, '0') + (faker.datatype.number(9999) + 1000),
            inspectionType: 'advanced',
            ownerGuid: createdBy,
            createdByGuid: createdBy
        });

        const job = await OrderJob.query(trx).insertAndFetch({
            status: 'new',
            orderGuid: order.guid,
            isDummy: false,
            isTransport: true,
            instructions: faker.lorem.words(60),
            estimatedExpense: carrierPay,
            estimatedRevenue: tariff,
            loadboardInstructions: faker.lorem.words(5),
            loadType: faker.random.arrayElement(capacityTypes),
            typeId: transportJobType.id,
            createdByGuid: createdBy
        });

        const stopDates = stopsDates();
        let stops = [];
        for (const type of ['pickup', 'delivery'])
        {
            const terminal = terminals.shift();
            const stop = {
                terminalGuid: terminal.guid,
                primaryContactGuid: terminal.primaryContactGuid,
                alternativeContactGuid: terminal.alternativeContactGuid,
                stopType: type,
                sequence: stops.length,
                notes: faker.lorem.sentence(),
                dateScheduledType: faker.random.arrayElement(dateTypes),
                createdByGuid: createdBy
            };

            stop.dateScheduledStart = stopDates[type].start;
            stop.dateScheduledEnd = stopDates[type].end;
            stops.push(stop);
        }
        stops = await OrderStop.query(trx).insertAndFetch(stops);

        let commodities = [];
        const numComs = faker.datatype.number(9) + 1;
        for (let i = 0; i < numComs; i++)
        {
            const vehicle = faker.random.arrayElement(vehicles);
            const comm = Commodity.fromJson({
                typeId: faker.random.arrayElement(vehicleTypes).id,
                identifier: faker.vehicle.vin(),
                vehicleId: vehicle.id,
                capacity: faker.random.arrayElement(capacityTypes),
                deliveryStatus: 'none',
                length: faker.datatype.number(3) + 12,
                weight: faker.datatype.number(1000) + 2500,
                quantity: 1,
                damaged: faker.random.arrayElement(ternaryOptions),
                inoperable: faker.random.arrayElement(ternaryOptions),
                createdByGuid: createdBy,
                description: faker.lorem.words()
            });
            commodities.push(comm);
        }

        commodities = await Commodity.query(trx).insertAndFetch(commodities);

        let stopLinks = [];
        for (const comm of commodities)
        {
            for (const stop of stops)
            {
                // one for order
                stopLinks.push({
                    commodityGuid: comm.guid,
                    stopGuid: stop.guid,
                    orderGuid: order.guid,
                    createdByGuid: createdBy
                });

                // one for job
                stopLinks.push({
                    commodityGuid: comm.guid,
                    stopGuid: stop.guid,
                    orderGuid: order.guid,
                    jobGuid: job.guid,
                    createdByGuid: createdBy
                });
            }
        }

        stopLinks = await OrderStopLink.query(trx).insertAndFetch(stopLinks);
    });
};
