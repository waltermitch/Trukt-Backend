const { toJSON } = require('../envs/index');
const { spawn } = require('child_process');
const fs = require('fs');

// list of vars to ignore
const ignoreList =
    [
        'APPINSIGHTS_PROFILERFEATURE_VERSION',
        'APPINSIGHTS_SNAPSHOTFEATURE_VERSION',
        'APPLICATIONINSIGHTS_CONNECTION_STRING',
        'ApplicationInsightsAgent_EXTENSION_VERSION',
        'DIAGNOSTICS_AZUREBLOBCONTAINERSASURL',
        'DIAGNOSTICS_AZUREBLOBRETENTIONINDAYS',
        'DiagnosticServices_EXTENSION_VERSION',
        'InstrumentationEngine_EXTENSION_VERSION',
        'SnapshotDebugger_EXTENSION_VERSION',
        'WEBSITE_HTTPLOGGING_RETENTION_DAYS',
        'WEBSITE_NODE_DEFAULT_VERSION',
        'XDT_MicrosoftApplicationInsights_BaseExtensions',
        'XDT_MicrosoftApplicationInsights_Java',
        'XDT_MicrosoftApplicationInsights_Mode',
        'XDT_MicrosoftApplicationInsights_NodeJS',
        'XDT_MicrosoftApplicationInsights_PreemptSdk'
    ];

// desctructuring envs
const [
    , , ENV,
    AZURE_RESOURCE_GROUP_NAME,
    AZURE_APP_NAME
] = process.argv;

// check for --save flag
const save = process.argv.includes('--save');

if (!ENV || !AZURE_RESOURCE_GROUP_NAME || !AZURE_APP_NAME)
    throw new Error('Please pass all required arguments: ENV, AZURE_RESOURCE_GROUP_NAME and AZURE_APP_NAME');

/**
 * Compares the variables from in azure and in .env for a specific environment.
 * It creates a file with current azure envs
 * To test it please run: npm run azure:validate:env
 */
async function main()
{
    /**
     * 1. Get proper envs to compare correclty
     * 2. Get azure envs from azure calling az command, you probably need to do az login first
     * 3. Parse azure envs to key-value format so we have same formate for .env and azure envs
     * 4. Create file with azure envs, this allows a graphic comparison ig you need it
     * 5. Compare azure envs with .env and print the result
     */
    try
    {
        // STEP 1 load in the local/repo settings
        const config = toJSON(ENV);

        // if config didn't load throw error
        if (!config)
            throw new Error(`Could not load ${ENV}.env`);

        // STEP 2 load in azure/cloud envs
        const azureEnvVariablesJson = await getAzureEnvs(config.ENV);

        // STEP 3 compare azure envs with repo envs
        const differences = compareVars(config, azureEnvVariablesJson);

        // STEP 4 deal with differences
        handleDifferences(differences);

    }
    catch (error)
    {
        console.error(error);
        process.exit(0);
    }
}

function handleDifferences(differences)
{
    // if differences is empty, there is no missing envs
    if (Object.keys(differences).length === 0)
        console.log(`Everything is in sync with Azure for ${ENV} environment`);
    else
    {
        // if save flag is set, save the missing envs, otherwise just print them
        if (save)
            fs.writeFileSync(`./cloud-envs-${ENV}.json`, JSON.stringify(differences, null, 2));

        console.log(differences);
    }
}

function compareVars(local, cloud)
{
    // convert cloud to key-value format
    const cloudKeyValueFormat = {};

    for (const e of cloud)
        if (!ignoreList.includes(e.name))
            cloudKeyValueFormat[e.name] = e.value;

    // use rambda to compare
    const differences = {};

    for (const e of Object.keys(local))
    {
        // check if its in the cloud object and if it has the same value
        if (cloudKeyValueFormat[e] === local[e])
        {
            delete cloudKeyValueFormat[e];
            continue;
        }
        else
        {
            differences[e] =
            {
                local: local[e] || null,
                cloud: cloudKeyValueFormat[e] || null
            };
        }
    }

    // what is left in cloudKeyValueFormat is the missing ones
    for (const e of Object.keys(cloudKeyValueFormat))
        differences[e] =
        {
            local: null,
            cloud: cloudKeyValueFormat[e]
        };

    return differences;

}

async function getAzureEnvs(ENV)
{
    // set proper env
    let slot = '';
    switch (ENV)
    {
        case 'production':
        case 'prod':
            slot = null;
            break;
        case 'staging':
            slot = 'staging';
            break;
        case 'dev':
        case 'development':
            slot = 'dev';
            break;
    }

    const azureCommand = createAzureCommand(slot);

    return new Promise((resolve, reject) =>
    {
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

        az.on('error', (err) =>
        {
            console.error(err);
            reject(err);
        });
    });
}

function createAzureCommand(slot)
{
    let azureBaseCommand = `az webapp config appsettings list -g ${AZURE_RESOURCE_GROUP_NAME} -n ${AZURE_APP_NAME}`;

    // If slot is null, it is to check production envs
    slot ? azureBaseCommand += ` -s ${slot}` : null;

    return azureBaseCommand;
}
main();