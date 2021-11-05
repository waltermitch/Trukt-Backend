const enabledModules = process.env['accounting.modules'].split(';');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const QuickBooksService = require('./QuickBooksService');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceBill = require('../Models/InvoiceBill');
const Order = require('../Models/Order');
const currency = require('currency.js');
const InvoiceService = require('./InvoiceService');
const Invoice = require('../Models/Invoice');
const Bill = require('../Models/Bill');

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

    static async addBillLine(billGuid, invoiceGuid, line, currentUser)
    {
        const result = await InvoiceLine.transaction(async trx =>
        {
            // verifying bill and invoice
            const [bill, invoice] = await Promise.all([Bill.query(trx).findById(billGuid), invoiceGuid && Invoice.query(trx).findById(invoiceGuid)]);

            // if bill doesn't exist in table throw error
            if (!bill)
            {
                throw new Error('Bill does not exist.');
            }

            // if wrong invoice has been provided
            if (invoiceGuid && !invoice)
            {
                throw new Error('Invoice does not exist.');
            }

            // for bulk insert
            const linksArray = [];

            line.setCreatedBy(currentUser);
            line.linkBill(bill);
            linksArray.push(line);

            // if invoiceGuid exists create line and link
            if (invoiceGuid)
            {
                const invoiceLine = InvoiceLine.fromJson(line);
                invoiceLine.linkInvoice(invoice);
                linksArray.push(invoiceLine);
            }

            // bulk insert into Lines table
            const [newLine1, newLine2] = await InvoiceLine.query(trx).insert(linksArray);

            // if invoice then link lines
            if (newLine2)
            {
                await InvoiceService.LinkLines(newLine1.guid, newLine2.guid, trx);
            }

            // return only the bill item
            return newLine1;
        });
        return result;
    }

    static async updateBillLine(billGuid, lineGuid, line)
    {
        // To make sure if bill has been passed
        const bill = await Bill.query().findById(billGuid);

        // if no bill throw error
        if (!bill)
        {
            throw new Error('Bill does not exist.');
        }

        // linking and updateing
        line.linkBill(bill);

        // returning updated bill
        const newLine = await InvoiceLine.query().patchAndFetchById(lineGuid, line);

        // if line doesn't exist
        if (!newLine)
        {
            throw new Error('Line does not exist.');
        }

        return newLine;
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