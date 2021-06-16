const BaseModel = require('./BaseModel');

class Terminal extends BaseModel
{
    static get tableName()
    {
        return 'rcg_tms.terminals';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const Contact = require('./Contact');
        return {
            contacts: {
                relation: BaseModel.HasManyRelation,
                modelClass: Contact,
                join: {
                    from: 'rcg_tms.terminals.guid',
                    to: 'rcg_tms.contacts.contact_for'
                }
            },

            primaryContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Contact,
                join: {
                    from: 'rcg_tms.terminals.primary_contact',
                    to: 'rcg_tms.contacts.guid'
                }
            },

            alternativeContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Contact,
                join: {
                    from: 'rcg_tms.terminals.alternative_contact',
                    to: 'rcg_tms.contacts.guid'
                }
            }
        };
    }
}

module.exports = Terminal;