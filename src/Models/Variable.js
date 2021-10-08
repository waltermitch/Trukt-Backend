const BaseModel = require('./BaseModel');

class Variable extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.variables';
    }
}

module.exports = Variable;