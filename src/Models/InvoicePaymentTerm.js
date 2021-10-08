const BaseModel = require('./BaseModel');

class InvoicePaymentTerm extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoiceBillPaymentTerms';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = InvoicePaymentTerm;