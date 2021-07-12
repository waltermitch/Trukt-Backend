const BaseModel = require('./BaseModel');

class Request extends BaseModel 
{
    static get tableName()
    {
        return 'rcgTms.requests';
    }

    static get idColumn()
    {
        return 'guid';
    }
}