const Commodity = require('../Models/Commodity');
const ActivityManagerService = require('./ActivityManagerService');

class CommodityService
{
    static async registerDeletedCommodities(orderGuid, jobGuid, commodityGuids, currentUser)
    {
        const commodities = await Commodity.query().select(
            [
                'guid',
                'description',
                'identifier',
                'lotNumber'
            ]
        ).findByIds(commodityGuids).withGraphFetched('[vehicle]')
        .modifyGraph('vehicle', builder => builder.select('name'));

        const comPromies = [];
        for(const com of commodities)
        {
            comPromies.push(ActivityManagerService.createActivityLog({
                orderGuid,
                userGuid: currentUser,
                jobGuid,
                activityId: 33,
                extraAnnotations: {
                    guid: com.guid,
                    vin: com.identifier,
                    lotNumber: com.lotNumber,
                    name: com.description || com.vehicle.name
                }
            }));
        }

        await Promise.all(comPromies);
    }

}

module.exports = CommodityService;