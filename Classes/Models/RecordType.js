const BaseModel = require('./BaseModel');

class RecordTypeModel extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.recordtype';
    }

    static get idColumn()
    {
        return 'guid';
    }
}

module.exports = RecordTypeModel;