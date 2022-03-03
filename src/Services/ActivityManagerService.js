const PubSubService = require('../Services/PubSubService');
const ActivityLogType = require('../Models/ActivityLogType');
const { uuidRegex } = require('../Utils/Regexes');
const ActivityLog = require('../Models/ActivityLogs');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const User = require('../Models/User');
const { ValidationError, NotFoundError } = require('../ErrorHandling/Exceptions');
const { AppResponse } = require('../ErrorHandling/Responses');

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
                activity: true
            })
            .modifyGraph('activity', builder => builder.select('id', 'name'))
            .orderBy('dateCreated', 'DESC');

        activities.page = page + 1;
        activities.rowCount = rc;
        return activities;
    }

    /**
     * @param activityLogData.userGuid required
     * @param activityLogData.orderGuid required
     * @param activityLogData.jobGuid required
     * @param activityLogData.activityId required, id from activity_log_types table
     * @param activityLogData.extraAnnotations optional, json with extra information to add in the log
     */
    static async createActivityLog({ userGuid, orderGuid, jobGuid, activityId, extraAnnotations })
    {
        // validate payload and data
        const errored = await ActivityManagerService.validateAcivityPayload({ userGuid, orderGuid, jobGuid, activityId });

        // if no errors create and push to pubsub
        if (errored.status === 200)
        {
            // compose object with data for creation
            const statusManager = ActivityLog.fromJson({
                userGuid,
                orderGuid,
                jobGuid,
                activityId,
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
                    activity: true
                })
                .modifyGraph('activity', builder => builder.select('id', 'name'));

            // push to pubsub activity
            PubSubService.jobActivityUpdate(jobGuid, currentActivity);
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
     * @param activityLogData.activityId required, id from activity_log_types table
     * @returns {Status}
     */
    static async validateAcivityPayload({ userGuid, orderGuid, jobGuid, activityId })
    {
        const schema = {
            userGuid: value => uuidRegex.test(value),
            orderGuid: value => uuidRegex.test(value),
            jobGuid: value => uuidRegex.test(value),
            activityId: value => parseInt(value) === Number(value)
        };

        const validate = (object, schema) => Object
            .keys(schema)
            .filter(key => !schema[key](object[key]))
            .map(key => (new ValidationError(`${key} input is invalid.`)));

        const errors = validate({ userGuid, orderGuid, jobGuid, activityId }, schema);

        if (errors.length > 0)
        {
            const appResponse = new AppResponse(errors);
            appResponse.setStatus(400);

            return appResponse.toJSON();
        }

        // validate if actual data exists
        const [
            user,
            order,
            activityLogType,
            job
        ] = await Promise.all([
            User.query().findById(userGuid),
            Order.query().findById(orderGuid),
            ActivityLogType.query().findById(activityId),
            OrderJob.query().findById(jobGuid)
        ]);

        const appResponse = new AppResponse();
        if (!user)
        {
            appResponse.addError(new NotFoundError(`User ${userGuid} doesnt exist.`));
        }
        if (!order)
        {
            appResponse.addError(new NotFoundError(`Order ${orderGuid} doesnt exist.`));
        }
        if (!activityLogType)
        {
            appResponse.addError(new NotFoundError(`Activity type ${activityId} doesnt exist.`));
        }
        if (!job)
        {
            appResponse.addError(new NotFoundError(`Order job ${jobGuid} doesnt exist.`));
        }

        if (appResponse.doErrorsExist())
        {
            appResponse.setStatus(404);
            return appResponse.toJSON();
        }

        // if all good return clean payload
        return { status: 200, errors: [], data: {} };
    }
}

module.exports = ActivityManagerService;