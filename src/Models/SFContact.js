const BaseModel = require('./BaseModel');

class SFContact extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.contacts';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            'account': {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./SFAccount'),
                join: {
                    from: 'salesforce.contacts.accountId',
                    to: 'salesforce.accounts.sfId'
                }
            }
        };
    }
}

module.exports = SFContact;