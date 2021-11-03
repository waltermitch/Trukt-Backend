const enabledModules = process.env['accounting.modules'].split(';');
const QuickBooksService = require('./QuickBooksService');
const LineLinks = require('../Models/InvoiceLineLink');
const Invoice = require('../Models/InvoiceBill');
const CoupaService = require('./CoupaService');
const Line = require('../Models/InvoiceLine');
const Order = require('../Models/Order');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const res = await Invoice.query()
            .findOne({ 'guid': guid, 'isDeleted': false })
            .withGraphFetched(Invoice.fetch.details);

        return res;
    }

    static async getOrderInvoicesandBills(guid)
    {
        // Using order model to get all invoices
        const res = await Order
            .query()
            .findById(guid)
            .withGraphJoined({
                invoices: Invoice.fetch.details,
                jobs: { bills: Invoice.fetch.details }
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
                invoices: Invoice.fetch.details,
                jobs: { bills: Invoice.fetch.details }
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

    static async LinkLines(line1Guid, line2Guid)
    {
        const Lines = await Line.query().findByIds([line1Guid, line2Guid]).withGraphFetched('[invoice, bill, invoiceBill.[job]]');

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
                await LineLinks.query().insert({ line1Guid: line1Guid, line2Guid: line2Guid });
                return;
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
                // deleted the linked items from table
                await LineLinks.query().deleteById([line1Guid, line2Guid]);
                return;
            }
        }
    }

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
                if (invoice.isPaid)
                    continue;

                // add existing invoice externalSourceData to map
                invoiceMap.set(invoice.guid, invoice.externalSourceData || {});

                // map some order fiels to invoice
                invoice.client = order.client;
                invoice.orderNumber = order.number;

                if (enabledModules.includes('coupa') && ['LKQ Corporation', 'LKQ Self Service']?.includes(order?.client?.name))
                    CoupaInvoices.push(order);
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
                const invoice = await Invoice.query().patchAndFetchById(guid, { externalSourceData: data });

                results.push(invoice);
            }
            else
                results.push(data.error);
        }));

        return results;
    }

    static async searchInvoices(orderGuid)
    {
        const search = orderGuid.replace(/%/g, '');

        const res = await Invoice.query().where('order_guid', '=', search).withGraphJoined('lines');

        return res;
    }
}

module.exports = InvoiceService;