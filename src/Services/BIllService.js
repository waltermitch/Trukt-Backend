const QuickBooksService = require('./QuickBooksService');
const OrderJob = require('../Models/OrderJob');
const Bill = require('../Models/InvoiceBill');

class BillService
{
    static async getBill(guid)
    {
        const search = guid.replace(/%/g, '');

        const res = await Bill.query().findOne({ 'guid': search });

        return res?.[0];
    }

    static async createBills(arr)
    {
        const qb = OrderJob.query().withGraphFetched('[bills.[lines.[commodity.[stops.[terminal]], item.qbAccount]], vendor]');

        for (const guid of arr)
            qb.orWhere('guid', '=', guid);

        // get all the orders
        const orders = await qb;

        await QuickBooksService.createBills(orders);
    }
}

module.exports = BillService;