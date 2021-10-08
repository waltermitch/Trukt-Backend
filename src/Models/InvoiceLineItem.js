const BaseModel = require('./BaseModel');

class InvoiceLineItem extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoiceBillLineItems';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            qbAccount: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: require('./QBAccount'),
                join: {
                    from: 'rcgTms.invoiceBillLineItems.id',
                    through: {
                        from: 'quickbooks.account_mappings.item_id',
                        to: 'quickbooks.account_mappings.account_id'
                    },
                    to: 'quickbooks.accounts.id'
                }
            }
        };
    }

    /**
     * Used to compare two invoice line items,
     * usually compare api supplied item vs database item
     * @param {InvoiceLineItem} itemA
     * @param {InvoiceLineItem} itemB
     * @returns
     */
    static compare(itemA, itemB)
    {
        return (itemA.id != undefined && itemA.id === itemB.id) || (itemA.name != undefined && itemA.name === itemB.name);
    }
}

module.exports = InvoiceLineItem;