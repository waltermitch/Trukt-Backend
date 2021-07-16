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
}

module.exports = InvoiceLineItem;