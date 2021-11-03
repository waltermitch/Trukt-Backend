const { isNotDeleted } = require('./Mixins/RecordAuthors');
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

    static get modifiers()
    {
        const relations = {
            noSystemUser: builder =>
            {
                builder.andWhere('guid', '<>', process.env.SYSTEM_USER);
            }
        };
        Object.assign(relations, isNotDeleted(User.tableName));
        return relations;
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