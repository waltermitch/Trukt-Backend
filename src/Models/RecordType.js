const BaseModel = require('./BaseModel');

class RecordType extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.record_types';
    }

    static get idColumn()
    {
        return 'id';
    }
}

module.exports = RecordType;