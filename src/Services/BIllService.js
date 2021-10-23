const enabledModules = process.env['accounting.modules'].split(';');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const QuickBooksService = require('./QuickBooksService');
const InvoiceLine = require('../Models/InvoiceLine');
<<<<<<< Updated upstream
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const Bill = require('../Models/InvoiceBill');
=======
const InvoiceBill = require('../Models/InvoiceBill');
const Bill = require('../Models/InvoiceBill');
const Order = require('../Models/Order');
const currency = require('currency.js');
>>>>>>> Stashed changes

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
        // query to get all the orders with related objects
        const qb = Order.query().withGraphJoined('[jobs.[bills.[lines.[commodity.[stops.[terminal]], item.qbAccount]], vendor]]');

        // append all the order guids
        qb.whereIn('guid', arr);

        // get all the orders
        const orders = await qb;

        if (enabledModules.includes('quickbooks'))
        {
            const res = await QuickBooksService.createBills(orders);

            console.log(res);
        }
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