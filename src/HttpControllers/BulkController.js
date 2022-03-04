const OrderJobSerivce = require('../services/OrderJobService');
const InvoiceService = require('../Services/InvoiceService');
const OrderService = require('../services/OrderService');
const BillService = require('../Services/BillService');

class BulkController
{
    static async updateOrderUsers(req, res, next)
    {
        const bulkResponse = await OrderService.bulkUpdateUsers(req.body);

        if (bulkResponse.doErrorsExist())
            next({ instance: bulkResponse, onlySendErrorsToTelemetry: true });
        res.status(200).json(bulkResponse);
    }

    static async updateJobUsers(req, res, next)
    {
        const bulkResponse = await OrderJobSerivce.bulkUpdateUsers(req.body);

        if (bulkResponse.doErrorsExist())
            next({ instance: bulkResponse, onlySendErrorsToTelemetry: true });
        if (bulkResponse)
            res.status(200).json(bulkResponse);
    }

    static async updateJobDates(req, res, next)
    {
        const bulkResponse = await OrderJobSerivce.bulkUpdateDates(req.body, req.session.userGuid);

        if (bulkResponse.doErrorsExist())
            next({ instance: bulkResponse, onlySendErrorsToTelemetry: true });

        res.status(200).json(bulkResponse);
    }

    static async updateJobStatus(req, res, next)
    {
        const bulkResponse = await OrderJobSerivce.bulkUpdateStatus(req.body, req.session.userGuid);

        if (bulkResponse.doErrorsExist())
            next({ instance: bulkResponse, onlySendErrorsToTelemetry: true });
        res.status(200).json(bulkResponse);
    }

    static async updateJobPrices(req, res, next)
    {
        const bulkResponse = await OrderJobSerivce.bulkUpdatePrices(req.body, req.session.userGuid);

        if (bulkResponse.doErrorsExist())
            next({ instance: bulkResponse, onlySendErrorsToTelemetry: true });

        res.status(200).json(bulkResponse);
    }

    static async setJobsReadyBulk(req, res, next)
    {
        try
        {
            const bulkResponse = await OrderJobSerivce.setJobsToReady(req.body.jobGuids, req.session.userGuid);

            if (bulkResponse.doErrorsExist())
                next({ instance: bulkResponse, onlySendErrorsToTelemetry: true });
                
            res.status(202).json(bulkResponse);
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
            /**
             * @type {BulkResponse}
             */
            let bulkResponse = undefined;
            if (req.params.action == 'accept')
            {
                bulkResponse = await OrderService.acceptLoadTenders(orderGuids, req.session.userGuid);
            }
            else if (req.params.action == 'reject')
            {
                bulkResponse = await OrderService.rejectLoadTenders(orderGuids, req.body.reason, req.session.userGuid);
            }

            if (bulkResponse.doErrorsExist())
                next({ instance: bulkResponse, onlySendErrorsToTelemetry: true });

            res.status(200);
            res.json(bulkResponse);
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = BulkController;