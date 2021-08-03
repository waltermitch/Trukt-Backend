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

    /**
     *  Used to compare if the commodity has the current commodity type
     * @param {Commodity} commodity
     * @param {CommodityType} commType
     * @returns {boolean}
     */
    static compare(commodity, commType)
    {
        // do not want undefined values to match undefined values
        // one big line because of sort circuit boolean evaluation
        return (commType.id != undefined
            && (commType.id === commodity?.typeId || commType.id === commodity?.commType?.id)
        ) || (commType?.type != undefined && commType?.category != undefined
            && commType.category === commodity?.commType?.category
            && commType.type === commodity?.commType?.type);

    }
}

module.exports = CommodityType;