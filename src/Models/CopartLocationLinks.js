const BaseModel = require('./BaseModel');

class Bill extends BaseModel
{
    static get tableName()
    {
        return 'copart.locationLinks';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = Bill;