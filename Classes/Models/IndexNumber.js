const BaseModel = require('./BaseModel');

class IndexNumber extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.indexNumbers';
    }

}

module.exports = IndexNumber;