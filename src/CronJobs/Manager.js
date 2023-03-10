const SystemManagementService = require('../Services/SystemManagementService');
const StatusCacheManager = require('../EventManager/StatusCacheManager');
const TerminalService = require('../Services/TerminalService');
const EDIService = require('../Services/EDIService');
const QBO = require('../QuickBooks/API');
const Cron = require('node-cron');

const expressions =
{
    second: '*/1 * * * * *',
    fiveSeconds: '*/5 * * * * *',
    tenSeconds: '*/10 * * * * *',
    minute: '0 */1 * * * *',
    fiveMinutes: '0 */5 * * * *',
    tenMinutes: '0 */10 * * * *',
    thirtyMinutes: '0 */30 * * * *',
    hourly: '0 0 */1 * * *',
    biHourly: '0 0 */2 * * *',
    daily: '0 0 1 */1 * *',
    ediUpdate: '30 8,12,4 * * *'
};

// every 5 seconds
Cron.schedule(expressions.fiveSeconds, async () =>
{
    await TerminalService.dequeueUnresolvedTerminals();
});

// every 5 minutes
Cron.schedule(expressions.fiveMinutes, async () =>
{
    await StatusCacheManager.updateStatus();

    // await CoupaManager.checkCoupaQueue();
});

// every 10 minutes
Cron.schedule(expressions.tenMinutes, async () =>
{
    await TerminalService.queueUnresolvedTerminals();
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

// Schedule 8:30am , 12:30pm and 4:40pm
// notifying EID partners outside of work hours is completely pointless
Cron.schedule(expressions.ediUpdate, async () =>
{
    await EDIService.notifyEDIPartnerEnrouteOrders();
}, { timezone: 'America/Los_Angeles' });
