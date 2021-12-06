const { eqProps } = require('ramda');

const BaseModel = require('./BaseModel');
const Contact = require('./TerminalContact');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

const geoCoordFields = ['latitude', 'longitude'];
const zipCodeNoDashRegex = /^[^-]*[^ -]\w+/;

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
    static onConflictIgnore = true

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

    toApiString()
    {
        if (this.latitude && this.longitude)
        {
            return `{ "geometry" :{"x": ${this.longitude}, "y": ${this.latitude}}}`;
        }
        return `${this.street1}, ${this.city}, ${this.state} ${this.zipCode}`;
    }

    static hasTerminalsSameBaseInformation(terminal1, terminal2)
    {
        const hasSameBaseInfo = [
            eqProps('street1', terminal1, terminal2),
            eqProps('city', terminal1, terminal2),
            eqProps('state', terminal1, terminal2),
            eqProps('zipCode', terminal1, terminal2),
            eqProps('country', terminal1, terminal2)
        ].includes(false);

        return !hasSameBaseInfo;
    }

    static hasTerminalsSameExtraInformation(terminal1, terminal2)
    {
        const hasExtraBaseInfo = [eqProps('name', terminal1, terminal2), eqProps('street2', terminal1, terminal2), eqProps('locationType', terminal1, terminal2)]
            .includes(false);

        return !hasExtraBaseInfo;
    }

    /**
     * If zipCode contains a dash, use the zipCode until the dash
     * @param {*} terminal
     * @returns
     */
    static createStringAddress(terminal)
    {
        const { street1, city, state, zipCode, country } = terminal;

        const cityStr = city && `, ${city}` || '';
        const stateStr = state && `, ${state}` || '';
        const zipCodeStr = zipCode && `, ${zipCode.match(zipCodeNoDashRegex)}` || '';
        const countryStr = country && `, ${country}` || '';

        return `${street1}${cityStr}${stateStr}${zipCodeStr}${countryStr}`;
    }
}

Object.assign(Terminal.prototype, RecordAuthorMixin);
Object.assign(Terminal.prototype, FindOrCreateMixin);
module.exports = Terminal;