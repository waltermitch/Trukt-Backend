const BaseModel = require('./BaseModel');

class StatusLogTypes extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.statusLogTypes';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            statusLogs: {
                relation: BaseModel.HasManyRelation,
                modeClass: require('./ActivityLogs'),
                join: {
                    from: 'rcgTms.statusLogTypes.id',
                    to: 'rcgTms.statusLogs.statusId'
                }

            }
        };
    }
}

module.exports = StatusLogTypes;