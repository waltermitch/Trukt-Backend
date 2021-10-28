const OrderJob = require('../Models/OrderJob');
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

    static async getOrderFinances(req, res, next, type)
    {
        let orderGuid = req.params.orderGuid;

        try
        {
            // get request is job
            if (type == 'job')
            {
                // get Order Guid
                const result = await OrderJob.query().findById(req.params.jobGuid);
                if (!result)
                {
                    res.status(404).send(`Job with Guid ${req.params.jobGuid} not found.`);
                    return;
                }
                orderGuid = result.orderGuid;
            }
            const result = await InvoiceService.getOrderInvoicesandBills(orderGuid);
            if (!result)
            {
                res.status(404);
                res.send(`Order with Guid ${orderGuid} not found.`);
            }
            else
            {
                res.status(200);
                res.json(result);
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async getFinances(req, res, next, type)
    {
        let orderGuid = req.params.orderGuid;

        try
        {
            // get request is job
            if (type == 'job')
            {
                // get Order Guid
                const result = await OrderJob.query().findById(req.params.jobGuid);
                if (!result)
                {
                    res.status(404).send(`Job with Guid ${req.params.jobGuid} not found.`);
                    return;
                }
                orderGuid = result.orderGuid;
            }
            const result = await InvoiceService.getJobOrderFinances(orderGuid, type);
            if (!result)
            {
                res.status(404);
                res.send(`Order with Guid ${orderGuid} not found.`);
            }
            else
            {
                res.status(200);
                res.json(result);
            }
        }
        catch (error)
        {
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