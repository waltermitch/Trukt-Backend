const InvoiceService = require('../Services/InvoiceService');

class InvoiceController
{
    static async getInvoice(req, res)
    {
        const result = await InvoiceService.getInvoice(req.params.invoiceGuid);
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

    static async getJobInvoices(req, res)
    {
        try
        {
            const result = await InvoiceService.getJobInvoice(req.params.jobGuid);

            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            res.status(404);
            res.send(error);
        }
    }

    static async getOrderInvoices(req, res, next)
    {
        try
        {
            const result = await InvoiceService.getOrderInvoice(req.params.orderGuid);

            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            if (error.message == 'No Invoices')
            {
                res.status(404);
                res.send(`Invoices for ${req.params.orderGuid} guid not found.`);
            }
            next(error);
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