const BaseModel = require('./BaseModel');
const Contact = require('./Contact');

class Terminal extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.terminals';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {

        return {
            contacts: {
                relation: BaseModel.HasManyRelation,
                modelClass: Contact,
                join: {
                    from: 'rcgTms.terminals.guid',
                    to: 'rcgTms.contacts.terminalGuid'
                }
            },

            primaryContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Contact,
                join: {
                    from: 'rcgTms.terminals.primaryContactGuid',
                    to: 'rcgTms.contacts.guid'
                }
            },

            alternativeContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Contact,
                join: {
                    from: 'rcgTms.terminals.alternativeContactGuid',
                    to: 'rcgTms.contacts.guid'
                }
            }
        };
    }
}

module.exports = Terminal;