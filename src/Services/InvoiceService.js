const QuickBooksService = require('./QuickBooksService');
const Invoice = require('../Models/InvoiceBill');
const Order = require('../Models/Order');
const Coupa = require('../Coupa/API');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const search = guid.replace(/%/g, '');

        const res = await Invoice.query().findOne({ 'guid': search, 'isDeleted': false });

        return res;
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