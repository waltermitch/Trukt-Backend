const Triumph = require('../Triumph/API');
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

});

// every hour
Cron.schedule(expressions.hourly, async () =>
{
    //
});

// every 2 hours

// daily
Cron.schedule(expressions.daily, async () =>
{
    await Triumph.refreshToken();
});