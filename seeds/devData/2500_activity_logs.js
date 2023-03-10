const User = require('../../src/Models/User');
const ActivityLogType = require('../../src/Models/ActivityLogType');
const ActivityLog = require('../../src/Models/ActivityLogs');
const Loadboard = require('../../src/Models/Loadboard');
const OrderJob = require('../../src/Models/OrderJob');
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

        // get all orders jobs
        const allOrdersJobs = await OrderJob.query(trx).select('guid', 'order_guid');
        if (!allOrdersJobs)
        {
            throw new Error('No orders jobs found. Did you run the order seed?');
        }

        // get all status log types
        const allActivityTypes = await ActivityLogType.query(trx).select('id', 'name');
        if (!allActivityTypes)
        {
            throw new Error('No status types found. Did you created the status log schema?');
        }

        // get all loadboard names
        const allLoadboardNames = await Loadboard.query(trx).select('name');
        if (!allLoadboardNames)
        {
            throw new Error('No loadboards found. Did you created the loadboard schema?');
        }

        // Add 1 activity to every order
        const activityManagerLog = allOrdersJobs.map((order) =>
        {
            const randomStatus = random.arrayElement(allActivityTypes);
            return {
                user_guid: random.arrayElement(allUsers).guid,
                order_guid: order.orderGuid,
                job_guid: order.guid,
                activity_id: randomStatus.id,
                extra_annotations: getExtraAnnotations(randomStatus.name, allLoadboardNames) || null
            };
        });

        return await ActivityLog.query(trx).insert(activityManagerLog);
    });
};

function getExtraAnnotations(activityName, allLoadboards)
{
    if (activityName === 'Posted to' || activityName === 'Un-Posted from')
    {
        const randomLaodboards = random.arrayElements(allLoadboards);
        return {
            'loadboards': randomLaodboards.map((loandboard => loandboard.name))
        };
    }
}