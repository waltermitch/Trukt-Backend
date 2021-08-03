const Invoice = require('../Models/InvoiceBill');
const QBO = require('../QuickBooks/API');
const Order = require('../Models/Order');
const Coupa = require('../Coupa/API');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const res = await Invoice.query().where('guid', '=', guid);

        return res?.[0];
    }

    static async createInvoices(arr)
    {
        const qb = Order.query();

        for (const guid of arr)
            qb.orWhere('guid', '=', guid);

        // get all the orders
        const orders = await qb.withGraphFetched('invoices');

        // decide which system they will be invoiced in
        const QBInvoices = [];
        const CoupaInvoices = [];
        for (const order in orders)
        {
            // add logic to determine type of invoice to make
            console.log(order);
        }

        const res = await QBO.createInvoices(QBInvoices);

        // submit coupa PO's don't await
        Coupa.sendInvoices(CoupaInvoices);

        return res;
    }
}

module.exports = InvoiceService;