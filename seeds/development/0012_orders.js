const faker = require('faker');
const OrderStopLink = require('../../Classes/Models/OrderStopLink');
const Terminal = require('../../Classes/Models/Terminal');
const migration_tools = require('../../tools/migration');
const { DateTime } = require('luxon');

const capacity_types = ['Full TL', 'Partial TL'];
const ternary_options = migration_tools.ternary_options;
const date_types = [
    'estimated',
    'exactly',
    'no later than',
    'no earlier than'
];
const now = DateTime.now();
const current_year = now.year;

const daysInMonth = (month, year) =>
{
    return new Date(year, month, 0).getDate();
};

const getRandomNumber = (max) =>
{
    return Math.floor(Math.random() * max);
};

const getRandomArbitrary = (min, max) =>
{
    return Math.floor(Math.random() * (max - min) + min);
};

const setDateInfo = (pickup, delivery) =>
{
    const randMonth = getRandomArbitrary(now.month, 13);
    const randDay = getRandomArbitrary(now.day, (daysInMonth(randMonth, current_year) + 1));
    const randomHour = getRandomNumber(24);
    const randomMinute = getRandomNumber(60);

    pickup.customer_date_type = faker.random.arrayElement(date_types);
    const luxonDate = DateTime.local(current_year, randMonth, randDay, randomHour, randomMinute);
    pickup.date_scheduled_start_customer = luxonDate.toString();
    if (pickup.customer_date_type === 'estimated')
        pickup.date_scheduled_end_customer = luxonDate.plus({ days: 4, hours: 3 }).toString();

    delivery.customer_date_type = faker.random.arrayElement(date_types);
    delivery.date_scheduled_start_customer = luxonDate.plus({ days: getRandomNumber(14) }).toString();
    if (delivery.customer_date_type === 'estimated')
        delivery.date_scheduled_end_customer = luxonDate.plus({ days: 4, hours: 3 }).toString();
};

exports.seed = async function (knex)
{
    const vehicles = await knex.select('id', 'year', 'make', 'model').from('rcg_tms.vehicles');
    const vehicleTypes = await knex.select('id').from('rcg_tms.commodity_types');
    const terminals = await Terminal.query();
    let clients = await knex.raw('select a.name, a.guid__c from salesforce.account a, salesforce.recordtype r where r.name = ? and a.recordtypeid = r.sfid', ['Client']);
    clients = clients.rows;
    const graph = [];

    for (let c = 0; c < 1; c++)
    {
        const client = clients[c];
        const createdBy = faker.datatype.uuid();

        const job = {
            '#id': faker.datatype.uuid(),
            isDummy: Math.floor(Math.random() * 2) == 0,
            isTransport: true,
            estimatedExpense: 12,
            estimatedRevenue: 13,
            quotedRevenue: 13,
            estimatedIncome: 13,
            createdBy: faker.datatype.uuid(),
            typeId: 1
        };

        let neworder = {
            clientGuid: client.guid__c,
            instructions: faker.lorem.words(100),
            owner: createdBy,
            status: 'new',
            distance: 12,
            isDummy: false,
            createdBy: createdBy,
            '#id': faker.datatype.uuid(),
            jobs: [job]
        };

        let pickup = {
            terminalGuid: faker.random.arrayElement(terminals).guid,
            '#id': faker.datatype.uuid(),
            stopType: 'pickup',
            createdBy: createdBy
        };

        let delivery = {
            terminalGuid: faker.random.arrayElement(terminals).guid,
            '#id': faker.datatype.uuid(),
            stopType: 'delivery',
            createdBy: createdBy
        };

        setDateInfo(pickup, delivery);
        const numCommodities = Math.floor(Math.random() * 10) + 1;

        for (let i = 0; i < numCommodities; i++)
        {
            const vehicle = faker.random.arrayElement(vehicles);
            const comm = {
                name: vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model,
                type: faker.random.arrayElement(vehicleTypes).id,
                identifier: faker.vehicle.vin(),
                vehicleId: vehicle.id,
                capacity: faker.random.arrayElement(capacity_types),
                delivery_status: 'none',
                length: faker.datatype.number(12),
                weight: faker.datatype.number(3000),
                quantity: 1,
                damaged: faker.random.arrayElement(ternary_options),
                inoperable: faker.random.arrayElement(ternary_options),
                created_by: createdBy,
                description: faker.lorem.words(),
                '#id': faker.datatype.uuid()

            };
            graph.push({
                commodity: comm,
                stop: pickup,
                order: neworder,
                createdBy: faker.datatype.uuid()
            });
            if ('#id' in neworder)

                neworder = {
                    '#ref': neworder['#id']
                };

            graph.push({
                commodity: {
                    '#ref': comm['#id']
                },
                stop: delivery,
                order: neworder,
                createdBy: faker.datatype.uuid()
            });

            if ('#id' in pickup)
                pickup = {
                    '#ref': pickup['#id']
                };
            if ('#id' in delivery)
                delivery = {
                    '#ref': delivery['#id']
                };
            graph.push({
                commodity: {
                    '#ref': comm['#id']
                },
                stop: pickup,
                order: neworder,
                job: { '#ref': job['#id'] },
                createdBy: faker.datatype.uuid()
            });
            graph.push({
                commodity: {
                    '#ref': comm['#id']
                },
                stop: delivery,
                order: neworder,
                job: { '#ref': job['#id'] },
                createdBy: faker.datatype.uuid()
            });
        }
    }

    return OrderStopLink.query().insertGraph(graph, { relate: true, allowRefs: true });

    // return await knex.raw('UPDATE rcg_tms.order_jobs SET \"order\" = null RETURNING guid;').then(jobs =>
    // {
    //     return knex(table_name).del()
    //         .then(function ()
    //         {
    //             const orders = [];

    //             for (let i = 0; i < 30; i++)
    //                 orders.push({
    //                     guid: faker.datatype.uuid(),
    //                     number: 'number',
    //                     client: '6e018101-51ae-4544-997d-82545156bc3d',
    //                     instructions: 'instructions',
    //                     owner: faker.datatype.uuid(),
    //                     status: 'New',
    //                     distance: 12,
    //                     is_dummy: false,
    //                     is_deleted: false,
    //                     is_completed: false,
    //                     created_by: faker.datatype.uuid()
    //                 });

    //             // Inserts seed entries
    //             return knex(table_name).insert(orders).onConflict('number').ignore();
    //         });

    // });
};
