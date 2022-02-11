const BaseModel = require('./BaseModel');

class ActivityLogs extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.statusLogs';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        const StatusLogType = require('./StatusLogType');
        const User = require('./User');
        const Order = require('./Order');
        const OrderJob = require('./OrderJob');

        return {
            status: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: StatusLogType,
                join: {
                    from: 'rcgTms.statusLogs.statusId',
                    to: 'rcgTms.statusLogTypes.id'
                }
            },
            user: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: User,
                join: {
                    from: 'rcgTms.statusLogs.userGuid',
                    to: 'rcgTms.tmsUsers.guid'
                }
            },
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.statusLogs.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            job: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: OrderJob,
                join: {
                    from: 'rcgTms.statusLogs.jobGuid',
                    to: 'rcgTms.orderJobs.guid'
                }
            }
        };
    }
}

module.exports = ActivityLogs;