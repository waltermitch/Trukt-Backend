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
const { DateTime } = require('luxon');

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
            const [newLine1, newLine2] = await InvoiceLine.query(trx).insertAndFetch(linksArray);

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

    static async deleteBillLine(billGuid, lineGuid)
    {
        // To make sure if bill has been passed
        const bill = await Bill.query().findById(billGuid);

        // if no bill throw error
        if (!bill)
        {
            throw new Error('Bill does not exist.');
        }

        // to double check and see if commodity is attached
        const checkLine = await InvoiceLine.query().findById(lineGuid);

        // if attached throw error
        if (checkLine.itemId == 1 && checkLine.commodityGuid != null)
        {
            throw new Error('Deleting a transport line attached to a commodity is forbidden.');
        }

        // returning updated bill
        const newLine = await InvoiceLine.query().deleteById(lineGuid).returning('*');

        // if line doesn't exist
        if (!newLine)
        {
            throw new Error('Line does not exist.');
        }

        return;
    }

    static async deleteBillLines(billGuid, lineGuids)
    {
        const result = await InvoiceLine.transaction(async trx =>
        {
            // To make sure if bill has been passed
            const bill = await Bill.query(trx).findById(billGuid);

            // if no bill throw error
            if (!bill)
            {
                throw new Error('Bill does not exist.');
            }

            // to patch multiple lines at once
            const patchArrays = [];

            // creating array of patch updates
            for (let i = 0; i < lineGuids.length; i++)
            {
                patchArrays.push(InvoiceLine.query(trx).delete().where({ 'guid': lineGuids[i], 'invoiceGuid': billGuid, 'itemId': 1 }).whereNotNull('commodity_guid'));
            }

            // executing all updates
            const deletedLines = await Promise.all(patchArrays);

            // if any failed will return guids that failed
            if (deletedLines.includes(0))
            {
                const guids = [];
                for (let i = 0; i < deletedLines.length; i++)
                {
                    if (deletedLines[i] == 0)
                    {
                        guids.push(lineGuids[i]);
                    }
                }

                throw new Error(`Lines with guid(s): ${guids} cannot be deleted.`);
            }

            // if succeed then, returns nothing
            return;
        });

        // returns result of transaction
        return result;
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
                        const mergedData = Object.assign({}, billMap.get(e.bId), { 'quickbooks': { 'bill': { 'Id': e.Bill.Id } } });

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
                const trx = await InvoiceBill.transaction();

                // update all the bills and their lines
                const proms = await Promise.allSettled([InvoiceBill.query(trx).patchAndFetchById(guid, { externalSourceData: data, isPaid: true, datePaid: DateTime.utc().toString() }), InvoiceLine.query(trx).patch({ isPaid: true, transactionNumber: data?.quickbooks?.invoice?.Id }).where('invoiceGuid', guid)]);

                if (proms[0].status == 'fulfilled')
                {
                    await trx.commit();
                    results.push(proms[0].value);
                }
                else
                {
                    await trx.rollback();
                    results.push(proms[0].reason);
                }
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