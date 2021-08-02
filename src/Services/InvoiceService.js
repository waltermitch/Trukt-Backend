const Invoice = require('../Models/InvoiceBill');
const QBO = require('../QuickBooks/API');

class InvoiceService
{
    static async getInvoice(guid)
    {
        const res = await Invoice.query().where('guid', '=', guid);

        return res?.[0];
    }

    static async createInvoices(arr)
    {
        const res = await QBO.createInvoices(arr);

        return res;
    }
}

module.exports = InvoiceService;