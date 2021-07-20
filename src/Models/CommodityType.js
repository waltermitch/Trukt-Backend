const BaseModel = require('./BaseModel');

let commTypes = undefined;

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
            relation: BaseModel.HasManyRelation,
            modeClass: require('./Commodity'),
            join: {
                from: 'rcgTms.commodityTypes.id',
                to: 'rcgTms.commodities.type'
            }
        };
    }

    static async types()
    {
        if (!commTypes)

            commTypes = await CommodityType.query();

        // give the object that is requesting, a clone, so that it cannot
        // change the internal commTypes that will mess with other objects
        // that will need the commodity types
        const clone = commTypes.map(x => Object.assign({}, x));
        return clone;
    }
}

module.exports = CommodityType;