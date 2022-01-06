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
            const results = await OrderJobSerivce.setJobsToReadyBulk(req.body.jobGuids, req.session.userGuid);

            // check if there are any successfull status changes. If there are none,
            // throw all the exceptions in the exceptions list
            // otherwise convert all the exceptions into readable json formats
            // so the client can have both the successes and the failures
            if (results.acceptedGuids.length == 0)
            {
                throw results.exceptions;
            }
            else
            {
                results.exceptions = results.exceptions.map(error =>
                {
                    return error.toJson();
                });
            }
            for (const job of results.acceptedGuids)
            {
                emitter.emit('orderjob_status', job.orderGuid);
            }
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
            reduceResponse[orderGuid] = orderExported.value;

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
            reduceResponse[orderGuid] = orderExported.value;

            return reduceResponse;
        }, {});

        res.status(200).json(results);
    }
}

module.exports = BulkController;