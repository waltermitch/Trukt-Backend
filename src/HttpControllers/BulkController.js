const OrderJobSerivce = require('../services/OrderJobService');
const OrderService = require('../services/OrderService');
const BillService = require('../Services/BillService');
const InvoiceService = require('../Services/InvoiceService');
const emitter = require('../EventListeners/index');

class BulkController
{
    static async updateOrderUsers(req, res)
    {
        const results = await OrderService.bulkUpdateUsers(req.body);

        if (results)
            res.status(200).json(results);
    }

    static async updateJobUsers(req, res)
    {
        const results = await OrderJobSerivce.bulkUpdateUsers(req.body);

        if (results)
            res.status(200).json(results);
    }

    static async updateJobDates(req, res)
    {
        const results = await OrderJobSerivce.bulkUpdateDates(req.body, req.session.userGuid);
        res.status(200).json(results);
    }

    static async updateJobStatus(req, res)
    {
        const results = await OrderJobSerivce.bulkUpdateStatus(req.body, req.session.userGuid);
        res.status(200).json(results);
    }

    static async updateJobPrices(req, res)
    {
        const results = await OrderJobSerivce.bulkUpdatePrices(req.body, req.session.userGuid);

        res.status(200).json(results);
    }

    static async setJobsReadyBulk(req, res, next)
    {
        try
        {
            const results = await OrderJobSerivce.setJobsToReady(req.body.jobGuids, req.session.userGuid);

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
            const results = await InvoiceService.exportInvocies(orders);

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
            if (req.params.action == 'accept')
            {
                result = await OrderService.acceptLoadTenders(orderGuids, req.session.userGuid);
            }
            else if (req.params.action == 'reject')
            {
                result = await OrderService.rejectLoadTenders(orderGuids, req.body.reason, req.session.userGuid);
            }
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