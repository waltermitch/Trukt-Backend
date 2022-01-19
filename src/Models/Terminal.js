const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');
const { eqProps } = require('ramda');

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
        const Contact = require('./TerminalContact');

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
        const baseInfoKeys = [
            'street1',
            'city',
            'state',
            'zipCode',
            'country'
        ];
        return baseInfoKeys.every(key =>
        {
            const terminal1Value = terminal1[key]?.toLowerCase() || '';
            const terminal2Value = terminal2[key]?.toLowerCase() || '';

            return terminal1Value == terminal2Value;
        });
    }

    static hasTerminalsSameExtraInformation(terminal1, terminal2)
    {
        const exytraInfoKeys = ['name', 'street2', 'locationType'];
        return exytraInfoKeys.every(key =>
        {
            const terminal1Value = terminal1[key]?.toLowerCase() || '';
            const terminal2Value = terminal2[key]?.toLowerCase() || '';

            return terminal1Value == terminal2Value;
        });
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