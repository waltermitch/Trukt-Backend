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

    static async exportBills(req, res)
    {
        const orders = req.body.orders;
        const ordersExportPromises = orders.map(orderGuid => BillService.exportBills([orderGuid]));
        const ordersExported = await Promise.allSettled(ordersExportPromises);

        const results = ordersExported.reduce((reduceResponse, orderExported, arrayIndex) =>
        {
            const orderGuid = orders[arrayIndex];

            const result = orderExported.value?.[0];
            if (!result)
                reduceResponse[orderGuid] = { status: 404, error: 'Order Not Found', data: null };
            else if (result?.error)
                reduceResponse[orderGuid] = { status: 400, error: orderExported.value, data: null };
            else if (result?.success)
                reduceResponse[orderGuid] = { status: 204, error: null, data: orderExported.value };
            else
                reduceResponse[orderGuid] = { status: 200, error: null, data: orderExported.value };

            return reduceResponse;
        }, {});

        res.status(200).json(results);
    }

    static async exportInvocies(req, res)
    {
        const orders = req.body.orders;
        const ordersExportPromises = orders.map(orderGuid => InvoiceService.exportInvoices([orderGuid]));
        const ordersExported = await Promise.allSettled(ordersExportPromises);

        const results = ordersExported.reduce((reduceResponse, orderExported, arrayIndex) =>
        {
            const orderGuid = orders[arrayIndex];

            const result = orderExported.value?.[0];
            if (!result)
                reduceResponse[orderGuid] = { status: 500, error: 'Internal Server Error', data: null };
            else if (result?.error)
                reduceResponse[orderGuid] = { status: 400, error: orderExported.value, data: null };
            else if (result?.success)
                reduceResponse[orderGuid] = { status: 204, error: null, data: orderExported.value };
            else
                reduceResponse[orderGuid] = { status: 200, error: null, data: orderExported.value };

            return reduceResponse;
        }, {});

        res.status(200).json(results);
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