const BaseModel = require('./BaseModel');

class User extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.tmsUsers';
    }

    static get idColumn()
    {
        return 'guid';
    }

    $formatJson(json)
    {
        json = super.$formatJson(json);
        if (json.isDeleted)
        {
            json = undefined;
        }
        else
        {
            delete json.source;
            delete json.externalId;
            delete json.isDeleted;
        }
        return json;
    }
}

module.exports = User;