const BaseModel = require('./BaseModel');

class AccountModel extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.accounts';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = AccountModel;