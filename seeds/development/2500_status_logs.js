const Order = require('../../src/Models/Order');
const User = require('../../src/Models/User');
const StatusLogType = require('../../src/Models/StatusLogType');
const StatusLog = require('../../src/Models/StatusLog');
const Loadboard = require('../../src/Models/Loadboard');
const { random } = require('faker');

exports.seed = async function (knex)
{
    return knex.transaction(async (trx) =>
    {

        // Get all users
        const allUsers = await User.query(trx).select('guid');
        if (!allUsers)
        {
            throw new Error('No users found. Did you run the users seed?');
        }

        // get all orders
        const allOrders = await Order.query(trx).select('guid');
        if (!allOrders)
        {
            throw new Error('No orders found. Did you run the order seed?');
        }

        // get all status log types
        const allStatusTypes = await StatusLogType.query(trx).select('id', 'name');
        if (!allStatusTypes)
        {
            throw new Error('No status types found. Did you created the status log schema?');
        }

        // get all loadboard names
        const allLoadboardNames = await Loadboard.query(trx).select('name');
        if (!allLoadboardNames)
        {
            throw new Error('No loadboards found. Did you created the loadboard schema?');
        }

        // Add 1 status to every order
        const satusManagerLog = allOrders.map((order) =>
        {
            const randomStatus = random.arrayElement(allStatusTypes);
            return {
                user_guid: random.arrayElement(allUsers).guid,
                order_guid: order.guid,
                status_id: randomStatus.id,
                extra_annotations: getExtraAnnotations(randomStatus.name, allLoadboardNames) || null
            };
        });

        return await StatusLog.query(trx).insert(satusManagerLog);
    });
};

function getExtraAnnotations(statusName, allLoadboards)
{
    if (statusName === 'Posted to' || statusName === 'Un-Posted from')
    {
        const randomLaodboards = random.arrayElements(allLoadboards);
        return {
            'loadboards': randomLaodboards.map((loandboard => loandboard.name))
        };
    }
}