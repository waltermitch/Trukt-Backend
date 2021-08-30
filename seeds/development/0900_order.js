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
const migration_tools = require('../../tools/migration');
const faker = require('faker');
const Enums = require('../../src/Models/Enums');
const { DateTime } = require('luxon');
const StatusLog = require('../../src/Models/StatusLog');

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
        const capacityTypes = await new Enums(trx).select('load_capacity_types');
        const dateTypes = await new Enums(trx).select('date_schedule_types');
        const ternaryOptions = migration_tools.ternary_options;
        const createdBy = await User.query(trx).findOne('name', 'ilike', '%');
        if (!createdBy)
        {
            throw new Error('No user found. Did you run the users seed?');
        }
        const vehicles = await Vehicle.query(trx).limit(10);
        if (vehicles.length == 0)
        {
            throw new Error('No vehicles found. Did you run the vehicle seed?');
        }
        const vehicleTypes = await trx.select('id').from('rcg_tms.commodity_types');
        const transportJobType = await OrderJobType.query(trx).findOne('category', 'transport');

        const terminals = await Terminal.query(trx);
        if (terminals.length == 0)
        {
            throw new Error('No terminals found. Did you run the terminals seed?');
        }
        const clients = await SFAccount.query(trx).modify('byType', 'client').whereNotNull('guid').limit(100);
        if (clients.length == 0)
        {
            throw new Error('No SF client accounts found. Do you have the salesforce data?');
        }
        const vendors = await SFAccount.query(trx).modify('byType', 'carrier').whereNotNull('guid').limit(100);
        if (vendors.length == 0)
        {
            throw new Error('No SF carrier accounts found. Do you have the salesforce data?');
        }

        const numComs = faker.datatype.number(9) + 1;
        const carrierPay = (250 + faker.datatype.number(400)) * numComs;
        const tariff = carrierPay * 1.20;

        const client = faker.random.arrayElement(clients);

        const vendor = faker.random.arrayElement(vendors);
        const order = await Order.query(trx).insertAndFetch({
            status: 'new',
            clientGuid: client.guid,
            isDummy: false,
            instructions: faker.lorem.words(60),
            estimatedExpense: carrierPay,
            estimatedRevenue: tariff,
            referenceNumber: faker.lorem.word().toUpperCase().substring(0, 5).padEnd(5, '0') + (faker.datatype.number(9999) + 1000),
            inspectionType: 'advanced',
            dispatcherGuid: createdBy.guid,
            createdByGuid: createdBy.guid
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
            createdByGuid: createdBy.guid
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
                createdByGuid: createdBy.guid
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
                createdByGuid: createdBy.guid,
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
                    createdByGuid: createdBy.guid
                });

                // one for job
                stopLinks.push({
                    commodityGuid: comm.guid,
                    stopGuid: stop.guid,
                    orderGuid: order.guid,
                    jobGuid: job.guid,
                    createdByGuid: createdBy.guid
                });
            }
        }

        await OrderStopLink.query(trx).insertAndFetch(stopLinks);

        // Add created status to the log
        await StatusLog.query(trx).insert({
            userGuid: createdBy.guid,
            orderGuid: order.guid,
            statusId: 1
        });
    });
};
