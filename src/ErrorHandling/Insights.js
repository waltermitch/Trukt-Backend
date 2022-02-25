const appInsights = require('applicationinsights');

// importing this fake client so we can use this instead of using the real
// app insights client when running locally because we do not want to track
// our local instances with azure.
const fakeTelemetryClient = require('./FakeTelemetryClient');

/**
 * @type {appInsights.TelemetryClient}
 */
let client = {};

// check if we are running in local mode
const inTheCloud = [
    'dev',
    'development',
    'staging',
    'prod',
    'production'
].includes(process.env.NODE_ENV) && !process.env.LOCAL?.localeCompare('false');

if (inTheCloud)
{
    appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true, true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .setAutoCollectConsole(true)
        .setUseDiskRetryCaching(true)
        .setSendLiveMetrics(true);
    client = appInsights.defaultClient;
    client.context.tags[appInsights.defaultClient.context.keys.cloudRole] = process.env.NODE_ENV;
    appInsights.start();
}
else
{
    client = fakeTelemetryClient;
}

module.exports = client;