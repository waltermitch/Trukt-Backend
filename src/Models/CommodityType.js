const BaseModel = require('./BaseModel');

class CommodityType extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.commodityTypes';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            commodities: {
                relation: BaseModel.HasManyRelation,
                modeClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.commodityTypes.id',
                    to: 'rcgTms.commodities.type'
                }

            }
        };
    }
}

module.exports = CommodityType;