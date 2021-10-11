const QuickBooksService = require('./QuickBooksService');
const OrderJob = require('../Models/OrderJob');
const QBO = require('../QuickBooks/API');
const currency = require('currency.js');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const Bill = require('../Models/InvoiceBill');

let transportItem;

(async () =>
{
    transportItem = await InvoiceLineItem.query().findOne({ name: 'transport' });
})();

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

    /**
     * @description evenly splits a price across provided commodities
     * @param {InvoiceBill} bill an objection model of a single bill
     * @param {Commodity[]} commodities a list of objection commodities with atleast a guid
     * @param {Number} carrierPay a decimal number used to evenly split accross all commodity lines
     * @param {Guid || Object} currentUser
     * @returns a list of promises to update all the invoice lines with new amounts
     */
    static splitCarrierPay(bill, commodities, carrierPay, currentUser)
    {
        const lines = [];
        const distribution = currency(carrierPay).distribute(commodities.length);
        for (let i = 0; i < commodities.length; i++)
        {
            const amount = distribution[i].value;
            const line = InvoiceLine.fromJson({ amount: amount });
            line.setUpdatedBy(currentUser);
            lines.push(InvoiceLine.query().patch(line).findOne({
                commodityGuid: commodities[i].guid,
                invoiceGuid: bill.guid,
                itemId: transportItem.id
            }));
        }

        return lines;
    }
}

module.exports = BillService;