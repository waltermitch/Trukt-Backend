const { RecordAuthorMixin, isNotDeleted, AuthorRelationMappings } = require('./Mixins/RecordAuthors');
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
        const relations =
        {
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

        Object.assign(relations, AuthorRelationMappings(this.tableName));
        return relations;
    }

    static get modifiers()
    {
        const modifiers = {
            transportOnly(builder)
            {
                builder.join('rcgTms.invoiceBillLineItems', 'rcgTms.InvoiceBillLines.itemId', 'rcgTms.invoiceBillLineItems.id').where(builder =>
                {
                    builder.where({ 'rcgTms.invoiceBillLineItems.name': 'transport', 'rcgTms.invoiceBillLineItems.type': 'revenue' });
                });
            },
            isValid(builder)
            {
                builder.where('isValid', true);
            }
        };
        Object.assign(modifiers, isNotDeleted(InvoiceLine.tableName));
        return modifiers;
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        if (!(json?.item))
        {
            const item = {};
            for (const field of ['name', 'type', 'isAccessorial'])
            {
                if (field in json)
                {
                    item[field] = json[field];
                    delete json[field];
                }
            }

            if ('itemId' in json)
            {
                item.id = json.itemId;
            }

            if (Object.keys(item) > 0)
            {
                json.item = item;
            }
        }
        return json;
    }

    $formatJson(json)
    {
        json = super.$formatJson(json);
        if ('item' in json)
        {
            for (const field of ['name', 'isAccessorial'])
            {
                json[field] = json.item[field];
            }
            json.itemId = json.item.id;
            delete json.item;
        }

        if (json.commodity)
        {
            delete json.commodity.extraExternalData;
        }
        return json;
    }

}

Object.assign(InvoiceLine.prototype, RecordAuthorMixin);
module.exports = InvoiceLine;