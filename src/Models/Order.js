const BaseModel = require('./BaseModel');

class Order extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orders';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            client: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./SFAccount'),
                join: {
                    from: 'rcgTms.orders.clientGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            jobs: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.orders.guid',
                    to: 'rcgTms.orderJobs.orderGuid'
                }
            },
            commodities: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.orderGuid',
                        extra: ['lotNumber', 'stops'],
                        to: 'rcgTms.orderStopLinks.commodityGuid'
                    },
                    to: 'rcgTms.commodities.guid'
                }
            },
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orders.guid',
                    through: {
                        from: 'rcgTms.orderStopLinks.orderGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            },
            stopLinks: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderStopLink'),
                join: {
                    from: 'rcgTms.orders.guid',
                    to: 'rcgTms.orderStopLinks.orderGuid'
                }
            }

            // invoiceBills: {
            //     relation: BaseModel.HasManyRelation,
            //     modelClass: InvoiceBill,
            //     join: {
            //         from: 'rcgTms.orders.guid',
            //         to: 'rcgTms.invoiceBills.order'
            //     }
            // }
        };
    }
}

module.exports = Order;