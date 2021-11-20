const appInsights = require('applicationinsights');

appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true);
appInsights.start();
const client = appInsights.defaultClient;

switch (process.env.ENV)
{
    case 'dev':
    case 'development':
    case 'staging':
    case 'prod':
    case 'production':
        client.context.tags[appInsights.defaultClient.context.keys.cloudRole] = process.env.ENV;
        break;
    default:
        client.disableAppInsights = true;
}

module.exports = client;