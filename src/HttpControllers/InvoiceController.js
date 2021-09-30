const InvoiceService = require('../Services/InvoiceService');

class InvoiceController
{
    static async getInvoice(req, res)
    {
        const result = await InvoiceService.getInvoice(req.params.invoiceId);

        if (!result)
        {
            res.status(404);
            res.json({ 'error': 'Invoice Not Found' });
        }
        else
        {

            res.status(200);
            res.json(result);
        }
    }

    static async createInvoices(req, res)
    {
        const orders = req.body?.orders;

        if (!orders || orders.length == 0)
        {
            res.status(400);
            res.json({ 'error': 'Missing Or Empty Array' });
        }
        else
        {
            const result = await InvoiceService.createInvoices(orders);

            res.status(200);
            res.json(result);
        }
    }

    static async searchInvoices(req, res)
    {
        // search by order id
        if (req.query.order)
        {
            const result = await InvoiceService.searchInvoices(req.query.order);

            res.status(200);
            res.json(result);
        }
        else
        {
            res.status(400);
            res.json({ 'error': 'Missing Query Parameter' });
        }
    }
}

module.exports = InvoiceController;