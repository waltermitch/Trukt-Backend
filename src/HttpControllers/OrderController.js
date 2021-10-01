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

            OrderService.registerCreateOrderStatusManager(order, req.session.userGuid);
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
            const { filters = {}, page: pageByUser, rowCount } = req.body;

            // Backend uses pagination starting on 0 but client starts on 1
            const page = pageByUser - 1;
            const orders = await OrderService.getOrders(filters, page, rowCount);

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

    static async handleTenders(req, res, next)
    {
        try
        {
            if (req.params.action == 'accept')
            {
                await OrderService.acceptLoadTender(req.params.orderGuid, req.session.userGuid);
            }
            else if (req.params.action == 'reject')
            {
                await OrderService.rejectLoadTender(req.params.orderGuid, req.body.reason, req.session.userGuid);
            }
            res.status(200);
            res.send();
        }
        catch (err)
        {
            if (err.message == 'Order doesn\'t exist')
            {
                res.status(404);
                res.json(err.message);
            }
            res.status(400);
            res.json(err.message);

            // next(err);
        }
    }

    static async patchOrder(req, res, next)
    {
        try
        {
            const { body } = req;
            const order = await OrderService.patchOrder(body, req.session.userGuid);

            res.status(200);
            res.json(order);
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