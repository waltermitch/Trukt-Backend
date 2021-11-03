const BaseModel = require('./BaseModel');

class InvoicePaymentMethod extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoiceBillPaymentMethods';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = InvoicePaymentMethod;