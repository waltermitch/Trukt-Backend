const BaseModel = require('./BaseModel');

class QBPaymentTerm extends BaseModel
{
    static get tableName()
    {
        return 'quickbooks.payment_terms';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = QBPaymentTerm;