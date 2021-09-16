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

        res.status(200);
        res.json(result);
    }

    static async createInvoices(req, res)
    {
        try
        {
            const orders = req.body?.orders;

            if (!orders || orders == 0)
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
        catch (err)
        {
            console.log(err);
            res.status(err?.response?.status || 500);
            res.json(err?.response?.data || err?.response || err);
        }
    }
}

module.exports = InvoiceController;