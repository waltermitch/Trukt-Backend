const Bill = require('../Models/InvoiceBill');
const OrderJob = require('../Models/OrderJob');
const QBO = require('../QuickBooks/API');

class BillService
{
    static async getBill(guid)
    {
        const search = guid.replace(/%/g, '');

        const res = await Bill.query().where('guid', '=', search);

        return res?.[0];
    }

    static async createBills(arr)
    {
        const qb = OrderJob.query().withGraphFetched('[bills.[cosignee, lines.[commodity.[stops.[terminal]], item]], vendor]');

        for (const guid of arr)
            qb.orWhere('guid', '=', guid);

        // get all the orders
        const orders = await qb;

        await QBO.createBills(orders);
    }
}

module.exports = BillService;