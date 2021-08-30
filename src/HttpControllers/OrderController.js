const OrderService = require('../Services/OrderService');
const HttpRouteController = require('./HttpRouteController');

class OrderController extends HttpRouteController
{

    static async getOrder(req, res, next)
    {
        if (req.params.orderGuid)
        {
            try
            {
                const orderPayload = await OrderService.getOrderByGuid(req.params.orderGuid);
                if (orderPayload)
                {
                    res.status(200);
                    res.json(orderPayload);
                }
                else
                {
                    res.status(404);
                    res.send();
                }

            }
            catch (err)
            {
                next(err);
            }
        }
        else
        {
            res.status(400);
            res.send();
        }
    }

    static async createOrder(req, res, next)
    {
        // big kahuna payload
        try
        {
            let order = await OrderService.create(req.body, req.session.userGuid);
            order = await OrderService.getOrderByGuid(order.guid);
            res.status(201);
            res.json(order);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async getOrders(req, res, next)
    {
        try
        {
            const { filters = {}, page, rowCount } = req.body;
            const orders = await OrderService.getOrders(filters, page || 0, rowCount || 25);

            res.status(200);
            res.json(orders);
        }
        catch (error)
        {
            next({
                status: 500,
                data: { message: error?.message || 'Internal server error' }
            });
        }

    }
}

const controller = new OrderController();
module.exports = controller;