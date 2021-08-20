const Invoice = require('../Models/InvoiceBill');
const QBO = require('../QuickBooks/API');
const Order = require('../Models/Order');
const Coupa = require('../Coupa/API');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const search = guid.replace(/%/g, '');

        const res = await Invoice.query().where('guid', '=', search);

        return res?.[0];
    }

    static async createInvoices(arr)
    {
        const qb = Order.query().withGraphFetched('[invoices.[consignee, lines.[commodity.[stops.[terminal]], item]], client]');

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

            const res = await QBO.createInvoices(QBInvoices);

            // submit coupa PO's don't await
            Coupa.sendInvoices(CoupaInvoices);

            return res;
        }
    }
}

module.exports = InvoiceService;