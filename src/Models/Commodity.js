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
            }
        };
    }

}

module.exports = Commodity;