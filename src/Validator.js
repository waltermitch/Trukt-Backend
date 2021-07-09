const { DateTime } = require('luxon');
const ajv = require('ajv').default;
const fs = require('fs');

// cache of schemas
let schemas;

class Validator
{
    constructor() { }

    static evalSchema(name, payload)
    {
        // check for initialization
        initialize();

        // validate payload
        const valid = schemas.validate(name, payload);

        // errors array
        const errors = [];

        if (!valid)
            for (let i = 0; i < schemas.errors.length; i++)
            {
                // get pretty message
                const msg = prettify(schemas.errors[i]);

                // make sure it's not null
                if (msg)
                    errors.push(msg);
            }

        return errors;
    }
}

module.exports = Validator;

function prettify(error)
{
    // if random crap about schema.. remove
    if (error.message.includes('schema') || error.keyword.includes('$merge'))
        return null;

    // handle extra properties
    if (error.message.includes('must NOT have additional properties'))
    {
        error.message = error.message.replace('properties', 'property');

        error.message = error.message.concat(' ', error.params.additionalProperty);
    }

    // handle enum error
    if (error.message.includes('must be equal to one of the allowed values'))
    {
        // remove slashes
        while (error.instancePath.includes('/'))
            error.instancePath = error.instancePath.replace('/', '.');

        // add enum array to message
        error.message = error.message.concat(': [ ', error.params.allowedValues.join(', '), ' ]');
    }

    // check for empty string
    if (error.instancePath.length < 2)
        error.instancePath = 'body';

    // return pretty string
    return error.instancePath + ' ' + error.message;
}

function initialize()
{
    if (schemas) return;

    // init new validator object
    schemas = new ajv({ allErrors: true });

    // require('ajv-merge-patch')(schemas);

    // custom datetime format (don't want to install additional dependencies)
    schemas.addFormat('YYYY-MM-DDTHH:mm:ss.SSSZ', (input) =>
    {
        // check length and formatting
        return input.length === 24 && DateTime.fromISO(input).isValid;
    });

    // read all schema files in dir
    const files = fs.readdirSync(`${__dirname}/Schemas`);

    // load each schema into memory
    for (let i = 0; i < files.length; i++)
    {
        // save file in mem
        const temp = require(`${__dirname}/Schemas/${files[i]}`);

        // load into constructor
        schemas.addSchema(temp, temp.$id);
    }
}
