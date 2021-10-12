const BaseModel = require('./BaseModel');

class QBAccount extends BaseModel
{
    static get tableName()
    {
        return 'quickbooks.accounts';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = QBAccount;