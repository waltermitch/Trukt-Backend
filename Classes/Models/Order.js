const BaseModel = require('./BaseModel');

class Order extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orders';
    }
}

module.exports = Order;