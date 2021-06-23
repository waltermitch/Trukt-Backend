const BaseModel = require('./BaseModel');
const { sfpostfixRegex } = require('../Utils/Regexes');

class SalesforceModel extends BaseModel
{
    /**
     * removes fields from the object
     * @param {*} json
     * @param {*} fields
     * @returns
     */
    static removeFields(json, fields)
    {
        for (const field of fields)

            if (field in json)

                delete json[field];

        return json;
    }

    static mapFields(json, fields)
    {
        const keys = Object.keys(json);
        for (const key of keys)

            if (key in fields)
            {
                const newkey = fields[key];
                if (!(newkey in json))
                {
                    json[newkey] = json[key];
                    delete json[key];
                }
            }

        return json;
    }

    static mapFieldsInverse(json, fields)
    {
        for (const field in fields)
        {
            const key = fields[field];
            if (key in json && !(field in json))
            {
                json[field] = json[key];
                delete json[key];
            }
        }
        return json;
    }

    static renameFields(json)
    {
        const keys = Object.keys(json);
        for (const key of keys)
        {
            const newkey = key.replace(sfpostfixRegex, '');
            if (!(newkey in json))
            {
                json[newkey] = json[key];
                delete json[key];
            }
        }
        return json;
    }

    /**
     * this is to send the object to external source
     */
    $formatJson(json)
    {
        json = super.$formatJson(json);
        json = SalesforceModel.mapFieldsInverse(json, this.constructor.mappingFromExternal);
        json = SalesforceModel.removeFields(json, this.constructor.fieldsToHideFromExternal);
        return json;
    }

    /**
     * this is making object from external source
     */
    $parseJson(json)
    {
        json = super.$parseJson(json);
        json = SalesforceModel.mapFields(json, this.constructor.mappingFromExternal);
        return json;
    }

    /**
     * this is making model from database
     */
    $parseDatabaseJson(json)
    {
        json = super.$parseDatabaseJson(json);
        json = SalesforceModel.removeFields(json, this.constructor.fieldsToHideFromDatabase);
        return json;
    }

}

module.exports = SalesforceModel;