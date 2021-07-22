const BaseModel = require('./BaseModel');

class OrderJobType extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobTypes';
    }

    static get idColumn()
    {
        return 'id';
    }

}

module.exports = OrderJobType;