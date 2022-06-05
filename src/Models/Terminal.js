const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');
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

    $beforeInsert()
    {
        delete this['#id'];
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);
        for (const field of geoCoordFields)
        {
            if (field in json)
            {
                // geoCoordFields in trukt db are stored up to 7 decimal places
                // if a geocoord is provided that is not 7 decimal places
                // findorcreate breaks because since this is an integer
                // it looks for an exact match which it cannot find and returns
                // null. This is to make sure we can find existing terminals
                // no matter how precise the provided geocoords are.
                // Also, if geocode is provided as null values, then don't do parsing on it.
                // Otherwise, NaN will be returned.
                if (json[field] != null)
                    json[field] = parseFloat(parseFloat(json[field]).toFixed(7));
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

    isDifferent(terminal)
    {
        if (this.street1 !== terminal.street1)
            return true;
        if (this.city !== terminal.city)
            return true;
        if (this.state !== terminal.state)
            return true;
        if (this.zipCode !== terminal.zipCode)
            return true;
        else
            return false;
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
        const exytraInfoKeys = [
            'name',
            'street2',
            'locationType',
            'notes'
        ];

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

        const address = [];
        if (street1)
            address.push(street1);
        if (city)
            address.push(city);
        if (state)
            address.push(state);
        if (zipCode)
            address.push(zipCode.match(zipCodeNoDashRegex));
        if (country)
            address.push(country);

        return address.join(', ');
    }

    /**
     * @description This is for EDI orders that do not provide the locationType, and other stuff
     */
    setDefaultValues(isTender = false)
    {
        if (isTender && !this?.locationType)
            this.locationType = EDI_DEFAULT_LOCATION_TYPE;

        this.isResolved = false;
        this.resolvedTimes = 0;
        this.latitude = null;
        this.longitude = null;
    }

    /**
     * @description Query to search by address in vector_address
     * @param {*} address string with the address to search
     * @returns raw query
     */
    static searchByVectorAddress(address)
    {
        // Remove the following characters from the address: ; * & $ @
        const addressWithAllowCharacters = address.replace(/[;*&$@]/g, '');

        // split the query by spaces add wild card to the end of each word, and join them with &
        const addressVector = addressWithAllowCharacters
            .split(' ')
            .filter(addressWord => addressWord.length)
            .map(addressWord => addressWord + ':*')
            .join(' & ');

        return raw('vector_address @@ to_tsquery(\'english\', ? )', [addressVector]);
    }
}

Object.assign(Terminal.prototype, RecordAuthorMixin);
Object.assign(Terminal.prototype, FindOrCreateMixin);
module.exports = Terminal;