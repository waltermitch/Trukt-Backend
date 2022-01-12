const BaseModel = require('./BaseModel');

class EDIData extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.ediData';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const relationships =
        {
            order: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.ediData.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            }
        };
        return relationships;
    }

    static get modifiers()
    {
        return {
            loadTender(builder)
            {
                builder.where('documentNumber', '204');
            },
            loadTenderResponse(builder)
            {
                builder.where('documentNumber', '990');
            },
            statusUpdate(builder)
            {
                builder.where('documentNumber', '214');
            }
        };
    }

}

module.exports = EDIData;