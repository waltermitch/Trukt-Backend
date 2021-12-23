const appInsights = require('applicationinsights');

// importing this fake client so we can use this instead of using the real
// app insights client when running locally because we do not want to track
// our local instances with azure.
const fakeTelemetryClient = require('./FakeTelemetryClient');

let client = {};

if (process.env.local || process.env.LOCAL)
    client = fakeTelemetryClient;
else
    switch (process.env.ENV)
    {
        case 'dev':
        case 'development':
        case 'staging':
        case 'prod':
        case 'production':
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
            client.context.tags[appInsights.defaultClient.context.keys.cloudRole] = process.env.ENV;
            appInsights.start();
            break;
        default:
            client = fakeTelemetryClient;
    }

module.exports = client;