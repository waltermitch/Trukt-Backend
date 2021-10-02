const Order = require('../../src/Models/Order');
const OrderJob = require('../../src/Models/OrderJob');
const OrderJobType = require('../../src/Models/OrderJobType');
const OrderStop = require('../../src/Models/OrderStop');
const OrderStopLink = require('../../src/Models/OrderStopLink');
const Terminal = require('../../src/Models/Terminal');
const Vehicle = require('../../src/Models/Vehicle');
const Commodity = require('../../src/Models/Commodity');
const SFAccount = require('../../src/Models/SFAccount');
const User = require('../../src/Models/User');
const Enums = require('../../src/Models/Enums');
const StatusLog = require('../../src/Models/StatusLog');
const migration_tools = require('../../tools/migration');
const faker = require('faker');
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

exports.seed = async function (trx)
{

    const ternaryOptions = migration_tools.ternary_options;

    const [
        capacityTypes,
        dateTypes,
        vehicleTypes,
        transportJobType,
        client,
        vendor,
        terminals,
        vehicles,
        user
    ] = await Promise.all([
        new Enums(trx).select('load_capacity_types'),
        new Enums(trx).select('date_schedule_types'),

        trx.select('id').from('rcg_tms.commodity_types'),
        OrderJobType.query(trx).findOne('category', 'transport'),
        SFAccount.query(trx).modify('byType', 'client').findOne(builder => builder.whereNotNull('guid')),
        SFAccount.query(trx).modify('byType', 'carrier').findOne(builder => builder.whereNotNull('guid')),
        Terminal.query(trx).limit(10),
        Vehicle.query(trx).limit(10),
        User.query(trx).findOne('name', 'ilike', '%')
    ]);



    if (!vehicleTypes) throw new Error('No vehicle types found. Run the proper seed.');
    if (!transportJobType) throw new Error('No transport job type found. Run the proper seed.');
    if (!user) throw new Error('No user found. Run the proper seed.');
    if (!vehicles) throw new Error('No vehicles found. Run the proper seed.');
    if (!terminals) throw new Error('No terminals found. Run the proper seed.');
    if (!client) throw new Error('No SF client accounts found. Run the proper seed.');
    if (!vendor) throw new Error('No SF carrier accounts found. Run the proper seed.');

    const numComs = faker.datatype.number(9) + 1;
    const carrierPay = (250 + faker.datatype.number(400)) * numComs;
    const tariff = carrierPay * 1.20;

    const order = await Order.query(trx).insertAndFetch({
        status: 'new',
        clientGuid: client.guid,
        isDummy: false,
        instructions: faker.lorem.words(60),
        estimatedExpense: carrierPay,
        estimatedRevenue: tariff,
        referenceNumber: faker.lorem.word().toUpperCase().substring(0, 5).padEnd(5, '0') + (faker.datatype.number(9999) + 1000),
        inspectionType: 'advanced',
        dispatcherGuid: user.guid,
        createdByGuid: user.guid
    });

    const job = await OrderJob.query(trx).insertAndFetch({
        status: 'new',
        orderGuid: order.guid,
        vendorGuid: vendor.guid,
        isDummy: false,
        isTransport: true,
        instructions: faker.lorem.words(60),
        estimatedExpense: carrierPay,
        estimatedRevenue: tariff,
        loadboardInstructions: faker.lorem.words(5),
        loadType: faker.random.arrayElement(capacityTypes),
        typeId: transportJobType.id,
        createdByGuid: user.guid
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
            createdByGuid: user.guid
        };

        stop.dateScheduledStart = stopDates[type].start;
        stop.dateScheduledEnd = stopDates[type].end;
        stops.push(stop);
    }
    stops = await OrderStop.query(trx).insertAndFetch(stops);

    let commodities = [];
    for (let i = 0; i < numComs; i++)
    {
        const vehicle = faker.random.arrayElement(vehicles);
        const comm = Commodity.fromJson({
            type_id: faker.random.arrayElement(vehicleTypes).id,
            identifier: faker.vehicle.vin(),
            vehicle_id: vehicle.id,
            capacity: faker.random.arrayElement(capacityTypes),
            deliveryStatus: 'none',
            length: faker.datatype.number(3) + 12,
            weight: faker.datatype.number(1000) + 2500,
            quantity: 1,
            damaged: faker.random.arrayElement(ternaryOptions),
            inoperable: faker.random.arrayElement(ternaryOptions),
            createdByGuid: user.guid,
            description: vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model
        });
        commodities.push(comm);
    }

    commodities = await Commodity.query(trx).insertAndFetch(commodities);

    const stopLinks = [];
    for (const comm of commodities)
    {
        for (const stop of stops)
        {
            // one for order
            stopLinks.push({
                commodityGuid: comm.guid,
                stopGuid: stop.guid,
                orderGuid: order.guid,
                createdByGuid: user.guid
            });

            // one for job
            stopLinks.push({
                commodityGuid: comm.guid,
                stopGuid: stop.guid,
                orderGuid: order.guid,
                jobGuid: job.guid,
                createdByGuid: user.guid
            });
        }
    }

    await OrderStopLink.query(trx).insertAndFetch(stopLinks);

    // Add created status to the log
    await StatusLog.query(trx).insert({
        userGuid: user.guid,
        orderGuid: order.guid,
        statusId: 1
    });

    return trx;
};
