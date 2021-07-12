const BaseModel = require('./BaseModel');
const Order = require('./Order');

class OrderJob extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobs';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.orderJobs.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.jobGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            },
            commodities: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.jobGuid',
                        to: 'rcgTms.orderStopLinks.commodityGuid',
                        extra: ['lotNumber']
                    },
                    to: 'rcgTms.commodities.guid'
                }
            },

            loadboardPosts: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./LoadboardPost'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    to: 'rcgTms.loadboardPosts.jobGuid'
                }
            }
        };
    }
}

module.exports = OrderJob;