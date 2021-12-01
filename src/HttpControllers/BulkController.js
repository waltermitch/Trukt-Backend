const OrderJobSerivce = require('../services/OrderJobService');
const OrderService = require('../services/OrderService');

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
}

module.exports = BulkController;