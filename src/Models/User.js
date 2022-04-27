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
}

module.exports = User;