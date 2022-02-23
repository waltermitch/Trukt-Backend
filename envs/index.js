const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// load vars to process.env
function load()
{
    const env = setEnv();

    const file = path.join(__dirname, `./${env}.env`);

    dotenv.config({ path: file });
}

// get vars in json format
function toJSON(targetEnv)
{
    const env = setEnv(targetEnv);

    const file = fs.readFileSync(`./envs/${env}.env`, 'utf8');

    const config = dotenv.parse(file);

    return config;
}

function toAzureJSON(targetEnv)
{
    const vars = toJSON(targetEnv);

    // map each setting into the following format:
    const azureEnvVars = Object.keys(vars).reduce((acc, key) =>
    {
        if (vars[key] !== null && vars[key].length > 1)
            acc.push({
                name: key,
                value: vars[key],
                slotSetting: true
            });

        return acc;
    }, []);

    return azureEnvVars;
}

// helper function for choosing env
function setEnv(targetEnv)
{
    switch (targetEnv || process.env.NODE_ENV || 'local')
    {
        case 'production':
        case 'prod':
            return 'prod';
        case 'staging':
            return 'staging';
        case 'development':
        case 'dev':
            return 'dev';
        case 'pipeline':
            return 'pipeline';
        default:
            return 'local';
    }
}

module.exports = {
    load,
    toJSON,
    toAzureJSON
};