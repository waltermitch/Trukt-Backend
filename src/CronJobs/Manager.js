const SystemManagementService = require('../Services/SystemManagementService');
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const CoupaManager = require('../EventManager/CoupaManager');
const Triumph = require('../Triumph/API');
const QBO = require('../QuickBooks/API');
const Super = require('../Super/API');
const Cron = require('node-cron');
const TerminalsHandler = require('../EventManager/TerminalsHandler');
const StatusCacheManager = require('../EventManager/StatusCacheManager');

const expressions =
{
    second: '*/1 * * * * *',
    tenSeconds: '*/10 * * * * *',
    minute: '0 */1 * * * *',
    fiveMinutes: '0 */5 * * * *',
    thirtyMinutes: '0 */30 * * * *',
    hourly: '0 0 */1 * * *',
    biHourly: '0 0 */2 * * *',
    daily: '0 0 1 */1 * *'
};

// every second
// Cron.schedule(expressions.second, async () =>
// {
// });

// every 5 minutes
Cron.schedule(expressions.fiveMinutes, async () =>
{
    await StatusCacheManager.updateStatus();
    await CoupaManager.checkCoupaQueue();
});

// every 30 minutes
Cron.schedule(expressions.thirtyMinutes, async () =>
{
    await QBO.refreshToken();

    await SystemManagementService.generateTmsUserToken();
});

// every hour
Cron.schedule(expressions.hourly, async () =>
{
    // do stuff here
    await SystemManagementService.syncUsers();
});

// every 2 hours

// daily
Cron.schedule(expressions.daily, async () =>
{
    // kick off job but don't wait for it
    Super.retryCarrierUpdates();

    // get triumph token
    await Triumph.refreshToken();
    await QBO.syncListsToDB();
});

Cron.schedule(expressions.second, async () =>
{
    await StatusManagerHandler.checkStatus();
});

Cron.schedule(expressions.tenSeconds, async () =>
{
    await TerminalsHandler.verifyPendingTerminals();
});