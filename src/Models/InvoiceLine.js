const BaseModel = require('./BaseModel');

class InvoiceLine extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoiceBillLines';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            commodity: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.invoiceBillLines.commodityGuid',
                    to: 'rcgTms.commodities.guid'
                }
            },
            type: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.invoiceBillLines.itemId',
                    to: 'rcgTms.invoiceBillLineItems.id'
                }
            }
        };
    }
}

module.exports = InvoiceLine;