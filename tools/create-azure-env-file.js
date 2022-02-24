/**
 * This file is for bitbucket pipeline, it is called when pushing local .envs to azure
 * for automaticly sync the environament variables. It creates a json file with all envs in current .env for the specific ENV,
 * then the file with the envs is push by azure pipi. It adds new varibales if they do not exists in azure or updates the value if exists
 */
const fs = require('fs');

const [
    , ,
    NEW_AZURE_FILE_NAME,
    ENV
] = process.argv;

// validate params
if (!ENV)
    console.log('Did not pass in ENV, defaulting to NODE_ENV =', process.env.NODE_ENV);
if (!NEW_AZURE_FILE_NAME || !NEW_AZURE_FILE_NAME.endsWith('.json'))
    throw new Error('Please pass in a name for the new json file (File extension must be: .json)');

// atempt to load in .env file
const vars = require('../envs/index').toAzureJSON(ENV);

if (!vars)
    throw new Error('The .env file was not found for the current environment');

// write vars to file
fs.writeFileSync(NEW_AZURE_FILE_NAME, JSON.stringify(vars, null, 2));