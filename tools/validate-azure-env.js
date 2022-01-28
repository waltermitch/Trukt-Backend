const fs = require('fs');
const utils = require('util');
const { spawn } = require('child_process');

const fsPromise = utils.promisify(fs.writeFile);

const ENV = process.argv[2];
const LOCAL_SETTINGS_FILE_NAME = process.argv[3];
const AZURE_RESOURCE_GROUP_NAME = process.argv[4];
const AZURE_APP_NAME = process.argv[5];

if (!ENV || !LOCAL_SETTINGS_FILE_NAME || !AZURE_RESOURCE_GROUP_NAME || !AZURE_APP_NAME)
    throw new Error('Please pass all required arguments: ENV, LOCAL_SETTINGS_FILE_NAME, AZURE_RESOURCE_GROUP_NAME and AZURE_APP_NAME');

const NEW_AZURE_FILE_NAME = `azure.${ENV}.json`;
const local_settings = require(`../${LOCAL_SETTINGS_FILE_NAME}`);

/**
 * Compares the variables from in azure and local.settings for a specific environment.
 * It creates a file with current azure envs
 * To test it please run: npm run validate:azure:env:dev
 */
async function main()
{
    /**
     * 1. Get proper envs to compare correclty
     * 2. Get azure envs from azure calling az command, you probably need to do az login first
     * 3. Parse azure envs to key-value format so we have same formate for local.settings and azure envs
     * 4. Create file with azure envs, this allows a graphic comparison ig you need it
     * 5. Compare azure envs with local.settings and print the result
     */
    try
    {
        // STEP 1
        const { local_settings_env, azureSlot } = checkEnv(ENV);

        // STEP 2
        const azureEnvVariablesJson = await getAzureEnvs(azureSlot);

        // STEP 3
        const azureEnvVariableKeyValueFormat = formatAzureEnvsToLocalSettings(azureEnvVariablesJson);

        // SETP 4
        await createAzureEnvFile(NEW_AZURE_FILE_NAME, azureEnvVariableKeyValueFormat);

        // STEP 5
        const envsCompared = await compareAzureWithLocalEnvs(NEW_AZURE_FILE_NAME, local_settings_env);

        if (envsCompared.length)
            console.log(envsCompared);
        else
            console.log(`All envs in Azure and in locall.setting for ${ENV} environment have the same values and there is no one missing`);

    }
    catch (error)
    {
        console.error(error);
        process.exit(0);
    }
}

function compareAzureWithLocalEnvs(azureFileName, localSettingsEnv)
{
    const azure_envs = require(`../${azureFileName}`);
    if (!azure_envs)
        throw new Error(`Azure envs not valid, please verify ${azureFileName} was created correclty`);

    const envsLocalCompareToAzure = Object.keys(local_settings[localSettingsEnv] || {}).reduce((completeList, localEnvName) =>
    {
        const azureEnv = azure_envs[localEnvName];
        if (!azureEnv)
            completeList.push({ envName: localEnvName, message: 'NOT EXISTS IN AZURE' });
        else if (azureEnv !== local_settings[localSettingsEnv][localEnvName])
            completeList.push({ envName: localEnvName, message: 'HAS DIFFERENT VALUE IN AZURE' });

        return completeList;
    }, []);
    const envsAzureCompareToLocal = Object.keys(azure_envs)?.reduce((completeList, azureEnvName) =>
    {
        const localEnv = local_settings[localSettingsEnv][azureEnvName];
        if (!localEnv)
            completeList.push({ envName: azureEnvName, message: 'NOT EXISTS IN LOCAL' });
        else if (localEnv !== azure_envs[azureEnvName])
            completeList.push({ envName: azureEnvName, message: 'HAS DIFFERENT VALUE LOCALLY' });

        return completeList;
    }, []);

    return [...envsLocalCompareToAzure, ...envsAzureCompareToLocal];
}

async function createAzureEnvFile(newFileName, azureEnvJson)
{
    const azureEnvString = JSON.stringify(azureEnvJson);
    return await fsPromise(newFileName, azureEnvString);
}

function formatAzureEnvsToLocalSettings(azureEnvVariablesJson)
{
    return azureEnvVariablesJson?.reduce((alleEnvs, azureEnv) =>
    {
        const envName = azureEnv.name.trim();
        alleEnvs[envName] = azureEnv.value;
        return alleEnvs;
    }, {});
}

async function getAzureEnvs(slot)
{
    return new Promise((resolve, reject) =>
    {
        if (!AZURE_RESOURCE_GROUP_NAME)
            throw new Error(`Azure resource group: ${AZURE_RESOURCE_GROUP_NAME} is invalid`);
        if (!AZURE_APP_NAME)
            throw new Error(`Azure app name: ${AZURE_APP_NAME} is invalid`);

        const azureCommand = createAzureCommand(slot);
        const az = spawn(azureCommand, [], { shell: true });
        let azureEnvsStirng = '';

        az.stdout.on('data', (data) =>
        {
            azureEnvsStirng += data;
        });

        az.stderr.on('data', (err) =>
        {
            const bufferError = Buffer.from(err);
            const errorString = bufferError.toString();
            reject('Error calling azure: ' + errorString);
        });

        az.on('close', () =>
        {
            const azureEnvsJson = JSON.parse(azureEnvsStirng);
            resolve(azureEnvsJson);
        });
    });

}

function createAzureCommand(slot)
{
    const azureBaseCommand = `az webapp config appsettings list -g ${AZURE_RESOURCE_GROUP_NAME} -n ${AZURE_APP_NAME}`;

    // If slot is null, it is to check production envs
    return (slot && azureBaseCommand.concat(` -s ${slot}`)) || azureBaseCommand;
}

function checkEnv(ENV)
{
    switch (ENV)
    {
        case 'production':
            return { local_settings_env: 'production', azureSlot: null };
        case 'staging':
            return { local_settings_env: 'staging', azureSlot: 'staging' };
        default:
            return { local_settings_env: 'development', azureSlot: 'dev' };
    }
}

main();