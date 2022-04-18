const InvoiceService = require('../Services/InvoiceService');
const InvoiceLine = require('../Models/InvoiceLine');
const OrderJob = require('../Models/OrderJob');
const { NotFoundError } = require('../ErrorHandling/Exceptions');

class InvoiceController
{
    static async createInvoice(req, res, next)
    {
        const { order, account, relation, ..._ } = req.body;

        const currentUser = req.session.userGuid;
        try
        {
            const invoice = await InvoiceService.createInvoice(
                order,
                account, relation, currentUser
            );

            res.status(200);
            res.json(invoice);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async getInvoice(req, res, next)
    {
        const result = await InvoiceService.getInvoice(req.params.invoiceGuid);

        try
        {
            if (!result)
                throw new NotFoundError('Invoice Not Found');
            else
                res.status(200).json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async createInvoiceLine(req, res, next)
    {
        const invoiceGuid = req.params.invoiceGuid;
        const billGuid = (req.body.billGuid || null);
        const currentUser = req.session.userGuid;
        const line = InvoiceLine.fromJson(req.body);
        delete line.billGuid;

        try
        {
            const result = await InvoiceService.addInvoiceLine(invoiceGuid, billGuid, line, currentUser);

            res.status(200).json;
            res.json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async updateInvoiceLine(req, res, next)
    {
        const invoiceGuid = req.params.invoiceGuid;
        const lineGuid = req.params.lineGuid;
        const line = InvoiceLine.fromJson(req.body);
        const currentUser = req.session.userGuid;

        try
        {
            const result = await InvoiceService.updateInvoiceLine(invoiceGuid, lineGuid, line, currentUser);

            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async deleteInvoiceLine(req, res, next)
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
            next(error);
        }
    }

    static async deleteInvoiceLines(req, res, next)
    {
        const invoiceGuid = req.params.invoiceGuid;
        const lineGuids = req.body;

        try
        {
            const response = await InvoiceService.deleteInvoiceLines(invoiceGuid, lineGuids);

            res.status(response?.status ?? 200).send(response);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async LinkInvoiceLines(req, res, next)
    {
        try
        {
            await InvoiceService.LinkLines(req.params.line1Guid, req.params.line2Guid);

            res.status(200).send();
        }
        catch (error)
        {
            next(error);
        }
    }

    static async UnLinkInvoiceLines(req, res, next)
    {
        try
        {
            await InvoiceService.UnLinkLines(req.params.line1Guid, req.params.line2Guid);

            res.status(200).send();
        }
        catch (error)
        {
            next(error);
        }
    }

    static async getOrderFinances(req, res, next, type)
    {
        const guid = req.params.orderGuid || req.params.jobGuid;

        try
        {
            const result = await InvoiceService.getOrderFinances(guid, type);

            res.status(200);
            res.json(result);
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
                    throw new NotFoundError(`Job with Guid ${req.params.jobGuid} not found.`);

                orderGuid = result.orderGuid;
            }

            const result = await InvoiceService.getJobOrderFinances(orderGuid, type);

            if (!result)
                throw new NotFoundError(`Order with Guid ${orderGuid} not found.`);
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

    static async exportInvoice(req, res, next)
    {
        const { orderGuid } = req.params;

        try
        {
            const result = await InvoiceService.exportInvoices([orderGuid]);

            const invoice = result[orderGuid];

            // transform single element array to object
            invoice.data = invoice.data[0] || {};

            invoice.errors.throwErrorsIfExist();

            res.status(200).json(invoice);
        }
        catch (err)
        {
            next(err);
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