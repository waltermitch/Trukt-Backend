const BaseModel = require('./BaseModel');

class SFAccount extends BaseModel
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

module.exports = SFAccount;