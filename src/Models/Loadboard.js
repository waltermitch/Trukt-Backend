const BaseModel = require('./BaseModel');

class Loadboard extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.loadboards';
    }
    static get idColumn()
    {
        return 'name';
    }

    static get jsonSchema()
    {
        return {
            type: 'object',
            required: ['name'],

            properties: {
                name: { type: 'string' }
            }
        };
    }

}

module.exports = Loadboard;