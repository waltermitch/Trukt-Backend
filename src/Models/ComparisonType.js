const BaseModel = require('./BaseModel');

class ComparisonType extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.comparisonTypes';
    }

    static get idColumn()
    {
        return 'label';
    }
}

module.exports = ComparisonType;