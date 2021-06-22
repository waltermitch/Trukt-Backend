const BaseModel = require('./BaseModel');

class OrderStopLink extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderStopLinks';
    }

    static get idColumn()
    {
        return ['orderGuid', 'stopGuid', 'commodityGuid'];
    }

    static get relationMappings()
    {
        return {
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.orderStopLinks.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            commodity: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orderStopLinks.commodityGuid',
                    to: 'rcgTms.commodities.guid'
                }
            },
            stop: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orderStopLinks.stopGuid',
                    to: 'rcgTms.orderStops.guid'
                }
            },
            job: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.orderStopLinks.jobGuid',
                    to: 'rcgTms.orderJobs.guid'
                }
            }
        };
    }
}

module.exports = OrderStopLink;