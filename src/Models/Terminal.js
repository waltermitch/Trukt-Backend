const BaseModel = require('./BaseModel');
const Contact = require('./TerminalContact');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

const geoCoordFields = ['latitude', 'longitude'];

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
                    to: 'rcgTms.terminalContacts.terminalGuid'
                }
            },
            primaryContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Contact,
                join: {
                    from: 'rcgTms.terminals.primaryContactGuid',
                    to: 'rcgTms.terminalContacts.guid'
                }
            },
            alternativeContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Contact,
                join: {
                    from: 'rcgTms.terminals.alternativeContactGuid',
                    to: 'rcgTms.terminalContacts.guid'
                }
            }
        };
    }

    hasId()
    {
        return 'guid' in this;
    }

    findIdValue()
    {
        return { field: 'guid', id: this.id };
    }

    static uniqueColumns = ['latitude', 'longitude']

    $parseJson(json)
    {
        json = super.$parseJson(json);
        for (const field of geoCoordFields)
        {
            if (field in json)
            {
                json[field] = parseFloat(json[field]);
            }
        }
        json = this.mapIndex(json);
        return json;

    }

    $formatJson(json)
    {
        json = super.$formatJson(json);

        for (const field of geoCoordFields)
        {
            if (field in json)
            {
                json[field] = parseFloat(json[field]);
            }
        }
        return json;
    }
}

Object.assign(Terminal.prototype, RecordAuthorMixin);
Object.assign(Terminal.prototype, FindOrCreateMixin);
module.exports = Terminal;