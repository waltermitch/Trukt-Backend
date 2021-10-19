const QuickBooksService = require('./QuickBooksService');
const Invoice = require('../Models/InvoiceBill');
const Order = require('../Models/Order');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const res = await Invoice.query().findOne({ 'guid': guid, 'isDeleted': false }).withGraphFetched('[lines.item, consignee]');

        return res;
    }

    static async getJobInvoice(guid)
    {
        const res = await Invoice.query().leftJoinRelated('job').where('job.guid', guid);

        return res;
    }

    static async getOrderInvoice(guid)
    {
        // Using order model to get all invoices
        const res = await Order
            .query()
            .findById(guid)
            .withGraphJoined('[invoices, jobs.bills]');

        // to throw proper error
        if (res == undefined)
        {
            throw new Error('No Invoices');
        }

        // object to return invoices only
        const invoiceObject = {
            invoices: res.invoices,
            bills: []
        };

        // mapping through multiple jobs and pushing into bills array
        res.jobs.map((job) =>
        {
            invoiceObject.bills.push(...job.bills);
        });

        return invoiceObject;
    }

    static async createInvoices(arr)
    {
        // query to get all the orders with related objects
        const qb = Order.query().withGraphFetched('[invoices.[consignee, lines.[commodity.[stops.[terminal]], item.qbAccount]], client]');

        // append all the order guids
        for (const guid of arr)
            qb.orWhere('guid', '=', guid);

        // get all the orders
        const orders = await qb;

        // decide which system they will be invoiced in
        const QBInvoices = [];
        const CoupaInvoices = [];
        for (const order of orders)
        {
            // add logic to determine type of invoice to make
            if (['LKQ Corporation', 'LKQ Self Service']?.includes(order?.client?.name))
                CoupaInvoices.push(order);
            else
                QBInvoices.push(order);

            const res = await QuickBooksService.createInvoices(QBInvoices);

            // submit coupa PO's don't await
            // temporary commenting out
            // Coupa.sendInvoices(CoupaInvoices);

            return res;
        }
    }

    static async searchInvoices(orderGuid)
    {
        const search = orderGuid.replace(/%/g, '');

        const res = await Invoice.query().where('order_guid', '=', search).withGraphJoined('lines');

        return res;
    }
}

module.exports = InvoiceService;