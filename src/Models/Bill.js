const BaseModel = require('./BaseModel');

class Bill extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.bills';
    }

    static get idColumn()
    {
        return 'bill_guid';
    }
}

module.exports = Bill;