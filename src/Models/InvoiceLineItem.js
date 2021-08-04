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