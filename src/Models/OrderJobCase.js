const BaseModel = require("./BaseModel");

class OrderJobCase extends BaseModel
{
    static get tableName() {
        return 'rcgTms.orderJobCases';
    }
    
}

module.exports = OrderJobCase;