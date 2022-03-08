const listener = require('./index');
const ActivityManagerService = require('../Services/ActivityManagerService');

listener.on('commodity_deleted', ({ orderGuid, jobGuid, commodities, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([ActivityManagerService.registerDeletedCommodities(orderGuid, jobGuid, commodities, currentUser)]);
    });
});