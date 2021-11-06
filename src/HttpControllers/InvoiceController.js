const InvoiceService = require('../Services/InvoiceService');
const InvoiceLine = require('../Models/InvoiceLine');
const OrderJob = require('../Models/OrderJob');

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

    static async createInvoiceLine(req, res)
    {
        const invoiceGuid = req.params.invoiceGuid;
        const billGuid = (req.body.billGuid || null);
        const currentUser = req.session.userGuid;
        const line = InvoiceLine.fromJson(req.body);
        delete line.billGuid;
        try
        {
            const result = await InvoiceService.addInvoiceLine(invoiceGuid, billGuid, line, currentUser);
            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            if (error.message == 'Cannot link transport items!')
            {
                res.status(406);
                res.json(error.message);
            }
            else
            {
                res.status(404);
                res.json(error.message);
            }
        }
    }

    static async updateInvoiceLine(req, res)
    {
        const invoiceGuid = req.params.invoiceGuid;
        const lineGuid = req.params.lineGuid;
        const line = InvoiceLine.fromJson(req.body);
        try
        {
            const result = await InvoiceService.updateInvoiceLine(invoiceGuid, lineGuid, line);
            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            res.status(404);
            res.json(error.message);
        }
    }

    static async softDeleteInvoiceLine(req, res)
    {
        const invoiceGuid = req.params.invoiceGuid;
        const lineGuid = req.params.lineGuid;
        try
        {
            const result = await InvoiceService.deleteInvoiceLine(invoiceGuid, lineGuid);
            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            res.status(404);
            res.json(error.message);
        }
    }

    static async softDeleteInvoiceLines(req, res)
    {
        const invoiceGuid = req.params.invoiceGuid;
        const lineGuids = req.body;
        try
        {
            await InvoiceService.deleteInvoiceLines(invoiceGuid, lineGuids);
            res.status(200).send();
        }
        catch (error)
        {
            res.status(404);
            res.json(error.message);
        }
    }

    static async LinkInvoiceLines(req, res)
    {
        try
        {
            await InvoiceService.LinkLines(req.params.line1Guid, req.params.line2Guid);
            res.status(200).send();
        }
        catch (error)
        {
            res.status(406);
            res.json(`Cannot run due to Contraint: ${error.message}`);
        }
    }

    static async UnLinkInvoiceLines(req, res)
    {
        try
        {
            await InvoiceService.UnLinkLines(req.params.line1Guid, req.params.line2Guid);
            res.status(200).send();
        }
        catch (error)
        {
            res.status(406);
            res.json(`Cannot run due to Contraint: ${error.message}`);
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

    static async exportInvoice(req, res)
    {
        const result = (await InvoiceService.exportInvoices([req.params.orderGuid]))?.[0];

        if (result)
        {
            if (result.error)
                res.status(400);
            else
                res.status(200);

            res.json(result);
        }
        else
        {
            res.status(404);
        }
    }

    static async exportInvoices(req, res)
    {
        const orders = req.body?.orders;

        if (!orders || orders.length == 0)
        {
            res.status(400);
            res.json({ 'error': 'Missing Or Empty Array' });
        }
        else
        {
            const result = await InvoiceService.exportInvoices(orders);

            if (result)
            {
                res.status(200);
                res.json(result);
            }
            else
            {
                res.status(404);
                res.json({ 'error': 'Order Not Found' });
            }
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