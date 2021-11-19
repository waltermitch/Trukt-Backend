const BaseModel = require('./BaseModel');

class OrderNotes extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderNotes';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = OrderNotes;