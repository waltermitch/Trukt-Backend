/**
 * This file is for bitbucket pipeline, it is called when pushing local.settings envs to azure
 * for automaticly sync the environament variables. It creates a json file with all envs in local.settings for the specific ENV,
 * then the file with the envs is push by azure pipi. It adds new varibales if they do not exists in azure or updates the value if exists
 */
const fs = require('fs');
const localSettigns = require('../local.settings.json');

const ENV = process.argv[2];
const NEW_ENV_FILE_NAME = process.argv[3];

const { local_settings_env } = checkEnv(ENV);

if (local_settings_env && NEW_ENV_FILE_NAME && NEW_ENV_FILE_NAME.includes('.json'))
{
    const settingString = JSON.stringify(localSettigns[local_settings_env]);
    if (settingString)
    {
        fs.writeFileSync(NEW_ENV_FILE_NAME, settingString);
        fs.access(NEW_ENV_FILE_NAME, fs.constants.R_OK, (err) =>
        {
            if (err)
                throw new Error(`${NEW_ENV_FILE_NAME}: is not valid. ${err}`);
            else
                console.log(`File created with variables for ${ENV} environment`);
        });
    }
}
else if (!local_settings_env)
    throw new Error('Please check local.settings.json file exists');
else if (!NEW_ENV_FILE_NAME || !NEW_ENV_FILE_NAME.includes('.json'))
    throw new Error(`Please pass a valid file name. "${NEW_ENV_FILE_NAME}" is not valid`);

function checkEnv(ENV)
{
    switch (ENV)
    {
        case 'production':
            return { local_settings_env: 'production' };
        case 'staging':
            return { local_settings_env: 'staging' };
        default:
            return { local_settings_env: 'development' };
    }
}
