const BaseModel = require('./BaseModel');

class RecordType extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.recordtype';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = RecordType;