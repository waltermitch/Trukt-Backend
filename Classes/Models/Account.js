const BaseModel = require('BaseModel');

class AccountModel extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.accounts';
    }
}

module.exports = AccountModel;