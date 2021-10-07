const { RecordAuthorMixin, isNotDeleted } = require('./Mixins/RecordAuthors');
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
            item: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceLineItem'),
                join: {
                    from: 'rcgTms.invoiceBillLines.itemId',
                    to: 'rcgTms.invoiceBillLineItems.id'
                }
            },
            invoiceBill: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.invoiceBillLines.invoiceGuid',
                    to: 'rcgTms.invoiceBills.guid'
                }
            }
        };
    }

    static get modifiers()
    {
        const modifiers = {
            transportOnly(builder)
            {
                builder.join('rcgTms.invoiceBillLineItems', 'rcgTms.InvoiceBillLines.itemId', 'rcgTms.invoiceBillLineItems.id').where(builder =>
                {
                    builder.where({ 'rcgTms.invoiceBillLineItems.name': 'Transport', 'rcgTms.invoiceBillLineItems.type': 'revenue' });
                });
            }
        };
        Object.assign(modifiers, isNotDeleted(InvoiceLine.tableName));
        return modifiers;
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        if ('item' in json)
        {
            switch (typeof json.item)
            {
                case 'object':
                    // do nothing because object is what we want
                    break;
                case 'string':
                    // convert to the object the string value should be the name of the item
                    json.item = { name: json.item };
                    break;
                case 'number':
                    // convert to the object the number value should be the id of the item
                    json.item = { id: json.item };
                    break;
            }
            if (json.itemId)
            {
                json.item.id = json.itemId;
            }
            delete json.itemId;
        }
        return json;
    }
}

Object.assign(InvoiceLine.prototype, RecordAuthorMixin);
module.exports = InvoiceLine;