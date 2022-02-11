const PubSubService = require('../Services/PubSubService');
const StatusLogType = require('../Models/StatusLogType');
const { uuidRegex } = require('../Utils/Regexes');
const ActivityLog = require('../Models/StatusLog');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const User = require('../Models/User');

class ActivityManagerService
{
    static async getJobActivities({ pg, rc, orderGuid, jobGuid })
    {
        const page = pg - 1;

        // gettting all activities relevant to the job
        const activities = await ActivityLog.query().select([
            'id',
            'orderGuid',
            'dateCreated',
            'extraAnnotations',
            'jobGuid'
        ])
            .page(page, rc)
            .where({ 'jobGuid': jobGuid, 'orderGuid': orderGuid })
            .withGraphFetched({
                user: true,
                status: true
            })
            .modifyGraph('status', builder => builder.select('id', 'name'))
            .orderBy('dateCreated', 'DESC').debug(true);

        activities.page = page + 1;
        activities.rowCount = rc;
        return activities;
    }

    // FIXME: Not really needed
    static async getActivitybyId(jobGuid, id)
    {
        // getting current activity
        const activity = await ActivityLog.query().select([
            'id',
            'orderGuid',
            'dateCreated',
            'extraAnnotations',
            'jobGuid'
        ])
            .findById(id)
            .withGraphFetched({ user: true, status: true })
            .modifyGraph('statusIDName')
            .andWhere('jobGuid', jobGuid);

        return activity;
    }

    /**
     * @param activityLogData.userGuid required
     * @param activityLogData.orderGuid required
     * @param activityLogData.jobGuid required
     * @param activityLogData.statusId required, id from status_log_types table
     * @param activityLogData.extraAnnotations optional, json with extra information to add in the log
     */
    static async createAvtivityLog({ userGuid, orderGuid, jobGuid, statusId, extraAnnotations })
    {
        // validate payload and data
        const errored = await ActivityManagerService.validateAcivityPayload({ userGuid, orderGuid, jobGuid, statusId });

        // if no errors create and push to pubsub
        if (errored.status === 200)
        {
            // compose object with data for creation
            const statusManager = ActivityLog.fromJson({
                userGuid,
                orderGuid,
                jobGuid,
                statusId,
                extraAnnotations
            });

            // create activity in system
            const currentActivity = await ActivityLog.query().skipUndefined()
                .insert(statusManager, {
                    allowRefs: true
                })
                .returning([
                    'id',
                    'orderGuid',
                    'dateCreated',
                    'extraAnnotations',
                    'jobGuid'
                ])
                .withGraphFetched({
                    user: true,
                    status: true
                })
                .modifyGraph('status', builder => builder.select('id', 'name'));

            // notify pubsub
            PubSubService.jobActivityUpdate(jobGuid, currentActivity);
            console.log('Created Activity Using Activity!');
            return currentActivity;
        }
    }

    /**
     * @typedef {Object} Status
     * @property {string} status
     * @property {array} errors array
     * @property {Obejct} data Object
     */
    /**
     * Method validates incoming payload and its data for intergrity.
     * @param activityLogData.userGuid required
     * @param activityLogData.orderGuid required
     * @param activityLogData.jobGuid required
     * @param activityLogData.statusId required, id from status_log_types table
     * @returns {Status}
     */
    static async validateAcivityPayload({ userGuid, orderGuid, jobGuid, statusId })
    {
        const schema = {
            userGuid: value => uuidRegex.test(value),
            orderGuid: value => uuidRegex.test(value),
            jobGuid: value => uuidRegex.test(value),
            statusId: value => parseInt(value) === Number(value)
        };

        const validate = (object, schema) => Object
            .keys(schema)
            .filter(key => !schema[key](object[key]))
            .map(key => { return { data: `${key} input is invalid.` }; });

        const errors = validate({ userGuid, orderGuid, jobGuid, statusId }, schema);

        if (errors.length > 0)
        {
            // TODO: add new throw exception class
            return { status: 400, errors: errors, data: {} };
        }

        // validate if actual data exists
        const [
            user,
            order,
            statusLogType,
            job
        ] = await Promise.all([
            User.query().findById(userGuid),
            Order.query().findById(orderGuid),
            StatusLogType.query().findById(statusId),
            OrderJob.query().findById(jobGuid)
        ]);

        const errorArray = [];
        if (!user)
        {
            errorArray.push({ data: `User ${userGuid} doesnt exist.` });
        }
        if (!order)
        {
            errorArray.push({ data: `Order ${orderGuid} doesnt exist.` });
        }
        if (!statusLogType)
        {
            errorArray.push({ data: `Activity type ${statusId} doesnt exist.` });
        }
        if (!job)
        {
            errorArray.push({ data: `Order job ${jobGuid} doesnt exist.` });
        }

        if (errorArray.length > 0)
        {
            // TODO: add new throw exception class
            return { status: 404, errors: errorArray, data: {} };
        }

        // if all good return clean payload
        return { status: 200, errors: [], data: {} };
    }
}

module.exports = ActivityManagerService;