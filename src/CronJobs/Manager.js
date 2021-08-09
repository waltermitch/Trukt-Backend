const Triumph = require('../Triumph/API');
const QBO = require('../QuickBooks/API');
const Super = require('../Super/API');
const Cron = require('node-cron');

const expressions =
{
    thirtyMinutes: '0 */30 * * * *',
    hourly: '0 0 */1 * * *',
    biHourly: '0 0 */2 * * *',
    daily: '0 0 1 */1 * *'
};

// every 30 minutes
Cron.schedule(expressions.thirtyMinutes, async () =>
{
    await QBO.refreshToken();
});

// every hour
// Cron.schedule(expressions.hourly, async () =>
// {
//     // do stuff here
// });

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