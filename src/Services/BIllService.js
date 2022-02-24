const HttpError = require('../ErrorHandling/Exceptions/HttpError');
const InvoiceLineItem = require('../Models/InvoiceLineItem');
const AccountingFunc = require('../Azure/AccountingFunc');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceBill = require('../Models/InvoiceBill');
const InvoiceService = require('./InvoiceService');
const Invoice = require('../Models/Invoice');
const Order = require('../Models/Order');
const currency = require('currency.js');
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

                // TODO: add proper error class TBE-22
                throw new Error('Bill does not exist.');

            // if wrong invoice has been provided
            if (invoiceGuid && !invoice)

                // TODO: add proper error class TBE-22
                throw new Error('Invoice does not exist.');

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

            // TODO: add proper error class TBE-22
            throw new Error('Bill does not exist.');

        // linking and updateing
        line.linkBill(bill);

        // returning updated bill
        const newLine = await InvoiceLine.query().patchAndFetchById(lineGuid, line);

        // if line doesn't exist
        if (!newLine)

            // TODO: add proper error class TBE-22
            throw new Error('Line does not exist.');

        return newLine;
    }

    static async deleteBillLine(billGuid, lineGuid)
    {
        // To make sure if bill has been passed
        const bill = await Bill.query().findById(billGuid);

        // if no bill throw error
        if (!bill)

            // TODO: add proper error class TBE-22
            throw new Error('Bill does not exist.');

        // to double check and see if commodity is attached
        const checkLine = await InvoiceLine.query().findById(lineGuid);

        // if attached throw error
        if (checkLine.itemId == 1 && checkLine.commodityGuid != null)

            // TODO: add proper error class TBE-22
            throw new Error('Deleting a transport line attached to a commodity is forbidden.');

        // returning updated bill
        const newLine = await InvoiceLine.query().deleteById(lineGuid).returning('*');

        // if line doesn't exist
        if (!newLine)

            // TODO: add proper error class TBE-22
            throw new Error('Line does not exist.');

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

                // TODO: add proper error class TBE-22
                throw new Error('Bill does not exist.');

            // deleteing lines in bulk :: users are forbidden from deleting transport lines with commodity attached to it.
            const deletedLines = await InvoiceLine.query(trx).delete().whereIn('guid', lineGuids).where('invoiceGuid', billGuid).modify('isNotTransport');

            // checking if all have been deleted
            if (deletedLines != lineGuids.length)
            {
                // error array for uniquee messages
                const errorArray = [];

                // query all guids, and throw error for which return because they still exist.
                const failedLines = await InvoiceLine.query(trx).findByIds([lineGuids]);

                // looping through array to throw proper errors
                for (const l of failedLines)
                {
                    if (l.itemId == 1 && l.commodityGuid != null)
                    {
                        errorArray.push(`Deleting a transport line attached to a commodity is forbidden. Line guid: ${l.guid} `);
                    }
                    if (l.invoiceGuid != billGuid)
                    {
                        errorArray.push(`Deleting a line the doesn't belong to the bill is forbidden. Guid: ${l.guid} `);
                    }
                }

                // TODO: add proper error class TBE-22
                throw new Error(errorArray);
            }

            // if succeed then, returns nothing
            return;
        });

        // returns result of transaction
        return result;
    }

    static async exportBills(arr)
    {
        // remove duplicates in arr
        const unique = [...new Set(arr)];

        // query to get all the orders with related objects
        const orders = await Order.query()
            .whereIn('guid', unique)
            .withGraphFetched('[jobs.[type, bills.[lines(isNonZero, isNotPaid).[commodity.[stops.[terminal], vehicle, commType], item]], vendor]]');

        if (!orders.length)
            throw new HttpError(400, 'No Matching Orders Found');

        const qbBills = [];
        const billMap = new Map();

        // we will need to build a map based on order guid in order to handle batching
        // the key is the order guid and the value is an object of [status, error, data]
        // where status is result of operation, either error or data is present (should not be both)
        const results = {};

        // loop through all the orders
        for (const order of orders)
        {
            // initialize in map
            results[order.guid] = { data: [], errors: [], status: null };

            for (const job of order.jobs)
            {
                for (const bill of job.bills)
                {
                    // we will use these fields to identify the bill in errors and api calls
                    bill.orderGuid = order.guid;
                    bill.jobGuid = job.guid;
                    bill.orderNumber = order.number;
                    bill.jobNumber = job.number;
                    bill.jobType = job.type.category;

                    bill.vendor =
                    {
                        guid: job.vendor.guid,
                        name: job.vendor.name,
                        qbId: job.vendor.qbId,
                        sdGuid: job.vendor.sdGuid
                    };

                    if (bill.isPaid && Object.keys(bill.externalSourceData || {}).length > 0)
                    {
                        // TODO: add proper error class TBE-22
                        results[order.guid].status = 400;
                        results[order.guid].errors.push({
                            guid: bill.guid,
                            error: 'Bill Already Maked As Paid',
                            data: bill
                        });
                    }
                    else if (bill.lines.length == 0)
                    {
                        // TODO: add proper error class TBE-22
                        results[order.guid].status = 400;
                        results[order.guid].errors.push({
                            guid: bill.guid,
                            error: 'Bill Has No Non Zero Lines',
                            data: bill
                        });
                    }
                    else if (!bill.vendor.qbId)
                    {
                        // TODO: add proper error class TBE-22
                        results[order.guid].status = 400;
                        results[order.guid].errors.push({
                            guid: bill.guid,
                            error: `Bill ${bill.guid} has no vendor or vendor doesn't have a QBO Id`,
                            data: bill
                        });
                    }
                    else
                    {
                        // add bill to map (we will need to access externalSourceData later)
                        billMap.set(bill.guid, bill);

                        // also process the bill lines
                        for (const line of bill.lines)
                        {
                            if (line.commodity?.commType?.category === 'freight')
                                line.itemName = 'freight';
                            else
                                line.itemName = line.item.name;

                            // compose description
                            line.description = AccountingFunc.composeDescription(line);
                        }

                        // add bill to qbBills
                        qbBills.push(bill);
                    }
                }
            }
        }

        // this returns an array of failed and successful bills
        const res = await AccountingFunc.exportBills(qbBills);

        // set current timestamp
        const now = DateTime.utc().toString();

        await Promise.allSettled(res.map(async ({ system, data, error, status }) =>
        {
            if (status != 200)
            {
                // if we errored out we don't need to update the bill
                // just push error to results
                const billObj = billMap.get(error?.guid);

                // TODO: add proper error class TBE-22
                results[billObj.orderGuid].status = status;
                results[billObj.orderGuid].errors.push({
                    guid: error.guid,
                    error: error
                });
            }
            else
            {
                // if all is good try to update the bill in the database
                const billObj = billMap.get(data?.guid);

                // if no errors we will update the bill
                const trx = await InvoiceBill.startTransaction();

                // merge externalSourceData with current bill externalSourceData
                const curExternal = billObj.externalSourceData || {};

                if (system == 'quickbooks')
                    Object.assign(curExternal, { 'quickbooks': { 'Id': data.qbId } });

                try
                {
                    const [patchedBill] = await Promise.all([
                        InvoiceBill.query(trx)
                            .patchAndFetchById(data.guid, { externalSourceData: curExternal, isPaid: true, datePaid: now }),

                        InvoiceLine.query(trx)
                            .patch({ isPaid: true, transactionNumber: data.qbId, dateCharged: now })
                            .where('invoiceGuid', data.guid)
                    ]);

                    // only set 200 if all bills are successful
                    // any single error will set the status to 400
                    if (results[billObj.orderGuid].errors.length == 0)
                        results[billObj.orderGuid].status = 200;

                    // rename guid as billGuid
                    patchedBill.billGuid = data.guid;
                    patchedBill.orderNumber = billObj.orderNumber;

                    results[billObj.orderGuid].data.push(patchedBill);

                    await trx.commit();
                }
                catch (err)
                {
                    await trx.rollback();

                    // TODO: add proper error class TBE-22
                    results[billObj.orderGuid].status = 500;
                    results[billObj.orderGuid].errors.push({ guid: data.guid, error: err.message || err });
                }
            }
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