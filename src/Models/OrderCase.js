const BaseModel = require("./BaseModel");

class OrderCase extends BaseModel
{
    static get tableName() {
        return 'rcgTms.orderCases';
    }
    
}

module.exports = OrderCase;