const SystemManagementService = require('../Services/SystemManagementService');
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const StatusCacheManager = require('../EventManager/StatusCacheManager');
const TerminalService = require('../Services/TerminalService');
const QBO = require('../QuickBooks/API');
const Cron = require('node-cron');

const expressions =
{
    second: '*/1 * * * * *',
    tenSeconds: '*/10 * * * * *',
    minute: '0 */1 * * * *',
    fiveMinutes: '0 */5 * * * *',
    tenMinutes: '0 */10 * * * *',
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

    // await CoupaManager.checkCoupaQueue();
});

// every 10 minutes
Cron.schedule(expressions.tenMinutes, async () =>
{
    await TerminalService.resolveTerminals();
});

// every 30 minutes
Cron.schedule(expressions.thirtyMinutes, async () =>
{
    await SystemManagementService.generateTmsUserToken();
});

// every hour
Cron.schedule(expressions.hourly, async () =>
{
    await SystemManagementService.syncUsers();
});

// every 2 hours

// daily
Cron.schedule(expressions.daily, async () =>
{
    await QBO.syncListsToDB();
});

Cron.schedule(expressions.second, async () =>
{
    await StatusManagerHandler.checkStatus();
});
