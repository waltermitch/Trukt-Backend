const listener = require('./index');
const CommoditySerivce = require('../Services/CommodityService');
const ActivityManagerService = require('../Services/ActivityManagerService');

listener.on('commodity_deleted', ({ orderGuid, jobGuid, commodities, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([CommoditySerivce.registerDeletedCommodities(orderGuid, jobGuid, commodities, currentUser)]);
    });
});