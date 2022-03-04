const listener = require('./index');
const CommodityService = require('../Services/CommodityService');

listener.on('commodity_deleted', ({ orderGuid, jobGuid, commodities, currentUser }) =>
{
    setImmediate(async () =>
    {
        const proms = await Promise.allSettled([CommodityService.registerDeletedCommodities(orderGuid, jobGuid, commodities, currentUser)]);
    });
});