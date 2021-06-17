const BaseModel = require('./BaseModel');

class Order extends BaseModel
{
    static get tableName()
    {
        return 'rcg_tms.orders';
    }
}

module.exports = Order;