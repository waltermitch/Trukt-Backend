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

    static async handleTenderBulk(req, res, next)
    {
        const action = req.params.action;
        const currentUser = req.session.userGuid;
        const orderGuids = req.body.orderGuids;
        const reason = req.body.reason;

        try
        {
            let process;
            switch (action)
            {
                case 'accept':
                    process = OrderService.handleTendersAccept(orderGuids, currentUser);
                    break;
                case 'reject':
                    process = OrderService.handleTenderReject(orderGuids, currentUser, reason);
                    break;
            }

            const bulkResponse = await process;
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