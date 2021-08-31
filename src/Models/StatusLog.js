const BaseModel = require('./BaseModel');

class StatusLogs extends BaseModel
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
            }
        };
    }
}

module.exports = StatusLogs;