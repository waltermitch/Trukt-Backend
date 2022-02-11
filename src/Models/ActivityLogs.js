const BaseModel = require('./BaseModel');

class ActivityLogs extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.activityLogs';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        const ActivityLogType = require('./ActivityLogType');
        const User = require('./User');
        const Order = require('./Order');
        const OrderJob = require('./OrderJob');

        return {
            activity: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: ActivityLogType,
                join: {
                    from: 'rcgTms.activityLogs.activityId',
                    to: 'rcgTms.activityLogTypes.id'
                }
            },
            user: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: 'rcgTms.activityLogs.userGuid',
                    to: 'rcgTms.tmsUsers.guid'
                }
            },
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.activityLogs.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            job: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: OrderJob,
                join: {
                    from: 'rcgTms.activityLogs.jobGuid',
                    to: 'rcgTms.orderJobs.guid'
                }
            }
        };
    }
}

module.exports = ActivityLogs;