const BaseModel = require('./BaseModel');

class Commodity extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.commodities';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.commodities.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.commodityGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            },
            vehicle: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Vehicle'),
                join: {
                    from: 'rcgTms.commodities.vehicleId',
                    to: 'rcgTms.vehicles.id'
                }
            },
            vehicleType: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./CommodityType'),
                join: {
                    from: 'rcgTms.commodities.type',
                    to: 'rcgTms.commodityTypes.id'
                }
            }
        };
    }

    static get modifiers()
    {
        return {
            filterDistinct(builder)
            {
                // use distinctOn because we are using pg
                builder.distinctOn('guid');
            }
        };
    }
}

module.exports = Commodity;