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

    static modifiers = {
        byType(query, type)
        {
            query.where('object_type', 'ilike', type);
        },
        byName(query, name)
        {
            query.findOne('name', 'ilike', name);
        }
    }
}

module.exports = RecordType;