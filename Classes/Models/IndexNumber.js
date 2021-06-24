const BaseModel = require('./BaseModel');

class IndexNumber extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.indexNumbers';
    }

    static get idColumn()
    {
        return 'index';
    }
}

module.exports = IndexNumber;