const enabledModules = process.env['accounting.modules'].split(';');
const QuickBooksService = require('./QuickBooksService');
const LineLinks = require('../Models/InvoiceLineLink');
const InvoiceLine = require('../Models/InvoiceLine');
const InvoiceBill = require('../Models/InvoiceBill');
const CoupaService = require('./CoupaService');
const Line = require('../Models/InvoiceLine');
const Invoice = require('../Models/Invoice');
const Order = require('../Models/Order');
const Bill = require('../Models/Bill');
const { DateTime } = require('luxon');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const res = await InvoiceBill.query()
            .findOne({ 'guid': guid, 'isDeleted': false })
            .withGraphFetched(InvoiceBill.fetch.details);

        return res;
    }

    static async getOrderInvoicesandBills(guid)
    {
        // Using order model to get all invoices
        const res = await Order
            .query()
            .findById(guid)
            .withGraphJoined({
                invoices: InvoiceBill.fetch.details,
                jobs: { bills: InvoiceBill.fetch.details }
            });

        // order was not found, return undefined
        if (res == undefined)
        {
            return undefined;
        }

        // assigning orderId and Number to order invoice
        Object.assign(res.invoices[0], {
            order: {
                guid: res.guid,
                number: res.number
            }
        });

        // object to return array of bills and invoices
        const invoiceObject = {
            invoices: res.invoices,

            // flatten all the bills and assign job guid and number to each bill
            bills: res.jobs.reduce((bills, job) =>
            {
                const jobObject = {
                    guid: job.guid,
                    number: job.number
                };
                bills.push(...job.bills.map((bill) =>
                {
                    bill.job = jobObject;
                    return bill;
                }));
                return bills;
            }, [])
        };

        return invoiceObject;
    }

    static async getJobOrderFinances(guid, type)
    {
        // Using order model to get all invoices
        const res = await Order
            .query()
            .findById(guid)
            .withGraphJoined({
                invoices: InvoiceBill.fetch.details,
                jobs: { bills: InvoiceBill.fetch.details }
            });

        // order was not found, return undefined
        if (res == undefined)
        {
            return undefined;
        }

        // using type to make it more concrete
        if (type == 'job')
        {
            // flatten all the bills and assign job guid and number to each bill
            return res.jobs.reduce((bills, job) =>
            {
                const jobObject = {
                    guid: job.guid,
                    number: job.number
                };
                bills.push(...job.bills.map((bill) =>
                {
                    bill.job = jobObject;
                    return bill;
                }));
                return bills;
            }, []);
        }
        if (type == 'order')
        {
            // assigning orderId and Number to order invoice
            Object.assign(res.invoices[0], {
                order: {
                    guid: res.guid,
                    number: res.number
                }
            });
            return res.invoices;
        }
    }

    static async addInvoiceLine(invoiceGuid, billGuid, line, currentUser)
    {
        const result = await InvoiceLine.transaction(async trx =>
        {
            // verifying bill and invoice
            const [bill, invoice] = await Promise.all([billGuid && Bill.query(trx).findById(billGuid), Invoice.query(trx).findById(invoiceGuid)]);

            // if invoice doesn't exist in table throw error
            if (!invoice)
            {
                throw new Error('Invoice does not exist.');
            }

            // if wrong billGuid
            if (billGuid && !bill)
            {
                throw new Error('Bill does not exist.');
            }

            // for bulk insert
            const linksArray = [];

            line.setCreatedBy(currentUser);
            line.linkInvoice(invoice);
            linksArray.push(line);

            // if billGuid exists create line and link
            if (billGuid)
            {
                const billLine = InvoiceLine.fromJson(line);
                billLine.linkBill(bill);
                linksArray.push(billLine);
            }

            // bulk insert into Lines table
            const [newLine1, newLine2] = await InvoiceLine.query(trx).insertAndFetch(linksArray);

            // if two lines then link lines
            if (newLine2)
            {
                await InvoiceService.LinkLines(newLine1.guid, newLine2.guid, trx);
            }

            // return only the invoice item
            return newLine1;
        });
        return result;
    }

    static async updateInvoiceLine(invoiceGuid, lineGuid, line)
    {
        // To make sure if bill has been passed
        const invoice = await Invoice.query().findById(invoiceGuid);

        // if no bill throw error
        if (!invoice)
        {
            throw new Error('Invoice does not exist.');
        }

        // linking and updateing
        line.linkInvoice(invoice);

        // returning updated bill
        const newLine = await InvoiceLine.query().patchAndFetchById(lineGuid, line);

        // if line doesn't exist
        if (!newLine)
        {
            throw new Error('Line does not exist.');
        }

        return newLine;
    }

    static async deleteInvoiceLine(invoiceGuid, lineGuid)
    {
        // To make sure correct invoice was passed in
        const invoice = await Invoice.query().findById(invoiceGuid);

        // if no bill throw error
        if (!invoice)
        {
            throw new Error('Invoice does not exist.');
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

    static async deleteInvoiceLines(invoiceGuid, lineGuids)
    {
        // running transaction, because I want to undue updates because of failure
        const result = await InvoiceLine.transaction(async trx =>
        {
            // To make sure correct invoice was passed in
            const invoice = await Invoice.query(trx).findById(invoiceGuid);

            // incorrect invoice
            if (!invoice)
            {
                throw new Error('Invoice does not exist.');
            }

            // to patch multiple lines at once
            const patchArrays = [];

            // creating array of patch updates
            for (let i = 0; i < lineGuids.length; i++)
            {
                patchArrays.push(InvoiceLine.query(trx).delete().where({ 'guid': lineGuids[i], 'invoiceGuid': invoiceGuid }).whereNot('itemId', 1).whereNotNull('commodity_guid'));
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
        return result;
    }

    static async LinkLines(line1Guid, line2Guid, trx = null)
    {
        const Lines = await Line.query(trx).findByIds([line1Guid, line2Guid]).withGraphFetched('[invoice, bill, invoiceBill.[job]]');

        // not allowed to link transport items
        if (Lines[0]?.itemId == 1 && Lines[1]?.itemId == 1)
        {
            throw new Error('Cannot link transport items!');
        }

        if (!((Lines[1].bill?.billGuid && Lines[0].bill?.billGuid) || (Lines[0].invoice?.invoiceGuid && Lines[1].invoice?.invoiceGuid)))
        {
            // getting order Guid to compare if job belongs to order
            const orderGuid = (Lines[0].invoiceBill?.job?.orderGuid || Lines[1].invoiceBill?.job?.orderGuid);
            const orderGuid2 = (Lines[0].invoice?.orderGuid || Lines[1].invoice?.orderGuid);

            // if job belongs to order then we link lines
            if (orderGuid === orderGuid2)
            {
                // inserting after succesfully jumping through constraints
                await LineLinks.query(trx).insert({ line1Guid: line1Guid, line2Guid: line2Guid });
            }
        }
    }

    static async UnLinkLines(line1Guid, line2Guid)
    {
        const Lines = await Line.query().findByIds([line1Guid, line2Guid]).withGraphFetched('[invoice, bill, invoiceBill.[job]]');

        // not allowed to unlink transport items
        if (Lines[0]?.itemId == 1 && Lines[1]?.itemId == 1)
        {
            throw new Error('Cannot unlink transport items!');
        }

        // checking to see if order to order or job to job
        if (!((Lines[1].bill?.billGuid && Lines[0].bill?.billGuid) || (Lines[0].invoice?.invoiceGuid && Lines[1].invoice?.invoiceGuid)))
        {
            // getting order Guid to compare if job belongs to order
            const orderGuid = (Lines[0].invoiceBill?.job?.orderGuid || Lines[1].invoiceBill?.job?.orderGuid);
            const orderGuid2 = (Lines[0].invoice?.orderGuid || Lines[1].invoice?.orderGuid);

            // if job belongs to order then we link lines
            if (orderGuid === orderGuid2)
            {
                // deleted the linked items from table, considers both options
                await LineLinks.query().delete().where({ line1Guid: line1Guid, line2Guid: line2Guid }).orWhere({ line1Guid: line2Guid, line2Guid: line1Guid });
                return;
            }
        }
    }

    // This method will need to be redone, post Alpha launch
    // very janky and inefficient, no time to fix
    // TODO: refactor this method
    static async exportInvoices(arr)
    {
        // array for results
        const results = [];

        // query to get all the orders with related objects
        const qb = Order.query().whereIn('guid', arr);

        qb.withGraphFetched('[invoices.[consignee, lines(isNotPaid).[commodity.[stops.[terminal]], item.qbAccount]], client]');

        // get all the orders
        const orders = await qb;

        // decide which system they will be invoiced in
        const QBInvoices = [];
        const CoupaInvoices = [];

        // map used to get external data later on
        const invoiceMap = new Map();

        for (const order of orders)
            for (const invoice of order.invoices)
            {
                if (invoice.dateInvoiced)
                    continue;

                // add existing invoice externalSourceData to map
                invoiceMap.set(invoice.guid, invoice.externalSourceData || {});

                // map some order fiels to invoice
                invoice.client = order.client;
                invoice.orderNumber = order.number;

                if (enabledModules.includes('coupa') && ['LKQ Corporation', 'LKQ Self Service']?.includes(order?.client?.name))
                    CoupaInvoices.push(invoice);
                else if (enabledModules.includes('quickbooks'))
                    QBInvoices.push(invoice);
            }

        const promises = await Promise.allSettled([QuickBooksService.createInvoices(QBInvoices), CoupaService.createInvoices(CoupaInvoices)]);

        // for each successful invoice, update the invoice in the database
        for (const promise of promises)
            if (promise.reason)
                console.log(promise.reason);
            else
                for (const e of promise.value)
                    if (e?.Invoice)
                    {
                        // merge existing externalSourceData with new data
                        const mergedData = Object.assign({}, invoiceMap.get(e.bId), { 'quickbooks': { 'invoice': { 'Id': e.Invoice.Id, 'DocNumber': e.Invoice.DocNumber } } });

                        // update in map
                        invoiceMap.set(e.bId, mergedData);
                    }
                    else if (e.CoupaInvoice)
                    {
                        // merge existing externalSourceData with new data
                        const mergedData = Object.assign({}, invoiceMap.get(e.guid), { 'coupa': { 'invoice': e.CoupaInvoice } });

                        // update in map
                        invoiceMap.set(e.guid, mergedData);
                    }
                    else if (e.error)
                    {
                        const mergedData = Object.assign({}, invoiceMap.get(e.guid), { 'error': e });

                        // update in map
                        invoiceMap.set(e.guid, mergedData);
                    }

        // update all invoices in db
        await Promise.allSettled(Array.from(invoiceMap.entries()).map(async ([guid, data]) =>
        {
            if (!data.error)
            {
                // start trx
                const trx = await InvoiceBill.transaction();

                // update all invoices and their lines
                const proms = await Promise.allSettled([InvoiceBill.query(trx).patchAndFetchById(guid, { externalSourceData: data, isPaid: true, dateInvoiced: DateTime.utc().toString() }), InvoiceLine.query(trx).patch({ isPaid: true, transactionNumber: data?.quickbooks?.invoice?.Id }).where('invoiceGuid', guid)]);

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

        // check length of results
        if (results.length == 0)
            return [{ success: true, message: 'All Invoices Already Paid For This Order' }];

        return results;
    }

    static async searchInvoices(orderGuid)
    {
        const search = orderGuid.replace(/%/g, '');

        const res = await InvoiceBill.query().where('order_guid', '=', search).withGraphJoined('lines');

        return res;
    }
}

module.exports = InvoiceService;