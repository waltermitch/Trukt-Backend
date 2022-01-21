const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');
const { eqProps } = require('ramda');
const { raw } = require('objection');

const geoCoordFields = ['latitude', 'longitude'];
const zipCodeNoDashRegex = /^[^-]*[^ -]\w+/;
const EDI_DEFAULT_LOCATION_TYPE = 'business';

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

    /**
     * @description This is for EDI orders that do not provide the locationType
     */
    setDefaultValues(isTender = false)
    {
        if (isTender && !this?.locationType)
            this.locationType = EDI_DEFAULT_LOCATION_TYPE;
    }

    /**
     * @description Query to search by address in vector_address
     * @param {*} address string with the address to search
     * @returns raw query
     */
    static searchByVectorAddres(address)
    {
        // Remove the following characters from the address: ; * & $ @
        const addressWithAllowCharacters = address.replace(/[;*&$@]/g, '');

        // split the query by spaces add wild card to the end of each word, and join them with &
        const addressVector = (addressWithAllowCharacters.split(' ').filter(addressWord =>
        {
            if (addressWord.length)
                return addressWord + ':*';
        })).join(' & ');

        return raw('vector_address @@ to_tsquery(\'english\', ? )', [addressVector]);
    }
}

Object.assign(Terminal.prototype, RecordAuthorMixin);
Object.assign(Terminal.prototype, FindOrCreateMixin);
module.exports = Terminal;