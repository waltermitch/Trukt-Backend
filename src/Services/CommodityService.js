const Commodity = require('../Models/Commodity');
const Line = require('../Models/InvoiceLine');

class CommodityService
{
    static async deleteCommodity(guid, currentUser, trx = undefined)
    {
        // update for commodity
        const payload =
        {
            isDeleted: true,
            deletedByGuid: currentUser
        };

        await Promise.all([Commodity.query(trx).findById(guid).patch(payload), Line.query(trx).where('commodity_guid', guid).patch(payload)]);

        return;
    }
}

module.exports = CommodityService;