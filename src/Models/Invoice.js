const BaseModel = require('./BaseModel');

class Invoice extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoices';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = Invoice;