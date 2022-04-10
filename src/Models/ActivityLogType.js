const BaseModel = require('./BaseModel');

class ActivityLogTypes extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.activityLogTypes';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            activityLogs: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./ActivityLogs'),
                join: {
                    from: 'rcgTms.activityLogTypes.id',
                    to: 'rcgTms.activityLogs.activityId'
                }

            }
        };
    }
}

module.exports = ActivityLogTypes;