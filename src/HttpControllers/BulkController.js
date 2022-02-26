const OrderJobSerivce = require('../services/OrderJobService');
const InvoiceService = require('../Services/InvoiceService');
const OrderService = require('../services/OrderService');
const BillService = require('../Services/BillService');

class BulkController
{
    static async updateOrderUsers(req, res, next)
    {
        const { results, exceptions } = await OrderService.bulkUpdateUsers(req.body);

        if (exceptions.doErrorsExist())
            next({ instance: exceptions, onlySendErrorsToTelemetry: true });
        if (results)
            res.status(200).json(results);
    }

    static async updateJobUsers(req, res, next)
    {
        const { results, exceptions } = await OrderJobSerivce.bulkUpdateUsers(req.body);

        if (exceptions.doErrorsExist())
            next({ instance: exceptions, onlySendErrorsToTelemetry: true });
        if (results)
            res.status(200).json(results);
    }

    static async updateJobDates(req, res, next)
    {
        const { results, exceptions } = await OrderJobSerivce.bulkUpdateDates(req.body, req.session.userGuid);

        if (exceptions.doErrorsExist())
            next({ instance: exceptions, onlySendErrorsToTelemetry: true });

        res.status(200).json(results);
    }

    static async updateJobStatus(req, res, next)
    {
        const { results, exceptions } = await OrderJobSerivce.bulkUpdateStatus(req.body, req.session.userGuid);

        if (exceptions.doErrorsExist())
            next({ instance: exceptions, onlySendErrorsToTelemetry: true });
        res.status(200).json(results);
    }

    static async updateJobPrices(req, res, next)
    {
        const { results, exceptions } = await OrderJobSerivce.bulkUpdatePrices(req.body, req.session.userGuid);

        if (exceptions.doErrorsExist())
            next({ instance: exceptions, onlySendErrorsToTelemetry: true });

        res.status(200).json(results);
    }

    static async setJobsReadyBulk(req, res, next)
    {
        try
        {
            const { results, exceptions } = await OrderJobSerivce.setJobsToReady(req.body.jobGuids, req.session.userGuid);

            if (exceptions.doErrorsExist())
                next({ instance: exceptions, onlySendErrorsToTelemetry: true });
                
            res.status(202).json(results);
        }
        catch (error)
        {
            next(error);
        }

    }

    static async exportBills(req, res, next)
    {
        const { orders } = req.body;

        try
        {
            const results = await BillService.exportBills(orders);

            res.status(200).json(results);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async exportInvocies(req, res, next)
    {
        const { orders } = req.body;

        try
        {
            const results = await InvoiceService.exportInvoices(orders);

            res.status(200).json(results);
        }
        catch (err)
        {
            next(err);
        }
    }

    // TODO: Added for bulk oporations
    static async handleTendersBulk(req, res, next)
    {
        const orderGuids = req.body.orderGuids;

        try
        {
            let result;
            let exception;
            if (req.params.action == 'accept')
            {
                const { results, exceptions } = await OrderService.acceptLoadTenders(orderGuids, req.session.userGuid);

                result = results;
                exception = exceptions;
            }
            else if (req.params.action == 'reject')
            {
                const { results, exceptions } = await OrderService.rejectLoadTenders(orderGuids, req.body.reason, req.session.userGuid);
                result = results;
                exception = exceptions;
            }

            if (exception.doErrorsExist())
                next({ instance: exception, onlySendErrorsToTelemetry: true });

            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = BulkController;