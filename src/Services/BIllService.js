const enabledModules = process.env['accounting.modules'].split(';');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const QuickBooksService = require('./QuickBooksService');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceBill = require('../Models/InvoiceBill');
const Order = require('../Models/Order');
const currency = require('currency.js');

let transportItem;

(async () =>
{
    transportItem = await InvoiceLineItem.query().findOne({ name: 'transport' });
})();

class BillService
{
    static async getBill(guid)
    {
        const res = await InvoiceBill.query().findById(guid).withGraphFetched(InvoiceBill.fetch.details);

        return res;
    }

    static async exportBills(arr)
    {
        // array for results
        const results = [];

        // query to get all the orders with related objects
        const qb = Order.query().whereIn('guid', arr);

        qb.withGraphFetched('[jobs.[bills.[lines.[commodity.[stops.[terminal]], item.qbAccount]], vendor]]');

        // get all the orders
        const orders = await qb;

        if (!orders.length)
            return null;

        // which system to send bills to
        const qbBills = [];
        const billMap = new Map();

        // loop through all the orders
        for (const order of orders)
            for (const job of order.jobs)
                for (const bill of job.bills)
                {
                    if (bill.isPaid && Object.keys(bill?.externalSourceData).length > 0)
                    {
                        results.push({
                            guid: bill.guid,
                            error: 'Bill Already Maked As Paid',
                            externalSourceData: bill.externalSourceData
                        });
                        continue;
                    }

                    // add existing bill to map
                    billMap.set(bill.guid, bill.externalSourceData || {});

                    // map parent fields to child object
                    bill.jobNumber = job.number;
                    bill.vendor = job.vendor;

                    if (enabledModules.includes('quickbooks'))
                    {
                        qbBills.push(bill);
                    }
                }

        const promises = await Promise.allSettled([QuickBooksService.createBills(qbBills)]);

        // for each successful bill save to db
        for (const promise of promises)
            if (promise.reason)
                console.log(promise.reason);
            else
                for (const e of promise.value)
                    if (e.Bill)
                    {
                        // merge existing externalSourceData with new data
                        const mergedData = Object.assign({}, billMap.get(e.bId), { 'quickbooks': { 'Bill': { 'Id': e.Bill.Id } } });

                        // update in map
                        billMap.set(e.bId, mergedData);
                    }
                    else if (e.error || e.Fault)
                    {
                        const mergedData = Object.assign({}, billMap.get(e.guid), { 'error': e.Fault ? { 'error': e } : e });

                        billMap.set(e.guid, mergedData);
                    }

        // save all bills to db
        await Promise.allSettled(Array.from(billMap.entries()).map(async ([guid, data]) =>
        {
            if (!data.error)
            {
                const bill = await InvoiceBill.query().patchAndFetchById(guid, { externalSourceData: data, isPaid: true });

                results.push(bill);
            }
            else
                results.push(data.error);
        }));

        return results;
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