if (!process.env['knex.client'])
{
    const config = require('./local.settings.json').Values;
    for (const field in config)

        // apply the values in the settings.json
        // this is to simiulate what func app does
        // this needs to happen when using knex cli
        process.env[field] = config[field];

    const tempENV = process.env.NODE_ENV || config.values.ENV;

    if (tempENV in config)
    {
        const newConfig = config[tempENV];

        // update the values to the proper environment
        for (const field in newConfig)

            process.env[field] = newConfig;
    }
}