// need this to boot when not using azure func, AND when using azure func and on local machine
if (!process.env.ENV || (process.env.ENV && process.env.local === 'true'))
{
    const config = require('./local.settings.json');
    for (const field in config.Values)

        // apply the values in the settings.json
        // this is to simulate what func app does
        // this needs to happen when using knex cli
        process.env[field] = config.Values[field];

    let tempENV = process.env.NODE_ENV || config.Values.ENV;

    // map over env settings because people are lazy, make machine type it all out
    switch (tempENV)
    {
        case 'dev':
            tempENV = 'development';
            break;
        case 'prod':
            tempENV = 'production';
            break;
    }

    if (tempENV in config)
    {
        const newConfig = config[tempENV];

        // update the values to the proper environment
        for (const field in newConfig)

            process.env[field] = newConfig[field];
    }
}