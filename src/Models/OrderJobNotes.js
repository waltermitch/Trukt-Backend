const BaseModel = require('./BaseModel');

class OrderJobNotes extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobNotes';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = OrderJobNotes;