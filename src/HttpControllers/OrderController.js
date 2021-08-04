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
            const order = await OrderService.create(req.body);

            res.status(200);
            res.json(order);
        }
        catch (err)
        {
            next(err);
        }
    }
}

const controller = new OrderController();
module.exports = controller;