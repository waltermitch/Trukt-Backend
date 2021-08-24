const BaseModel = require('./BaseModel');

class Bill extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.bills';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = Bill;