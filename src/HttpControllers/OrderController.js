const OrderService = require('../Services/OrderService');
const NotesService = require('../Services/NotesService');

class OrderController
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

            // registering order to status manager
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
            const { filters = {}, page: pageByUser, rowCount, sort, globalSearch } = req.body;

            // Backend uses pagination starting on 0 but client starts on 1
            const page = pageByUser - 1;
            const orders = await OrderService.getOrders(filters, page, rowCount, sort, globalSearch);

            res.status(200);
            res.json(orders);
        }
        catch (error)
        {
            next(error);
        }

    }

    static async handleTenders(req, res, next)
    {
        const orderGuids = req.body.orderGuids;

        let responses = [];
        if (req.params.action == 'accept')
        {
            responses = await OrderService.acceptLoadTenders(orderGuids, req.session.userGuid);
        }
        else if (req.params.action == 'reject')
        {
            responses = await OrderService.rejectLoadTenders(orderGuids, req.body.reason, req.session.userGuid);
        }

        res.status(200);
        res.json(responses);
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
            next(error);
        }
    }

    // find order by vin
    static async findOrdersByVin(req, res, next)
    {
        try
        {
            const { vin } = req.params;
            const orders = await OrderService.findByVin(vin);

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

    // find notes only related to order
    static async getOrderNotes(req, res, next)
    {
        try
        {
            const result = await NotesService.getOrderNotes(req.params.orderGuid);

            if (!result)
                res.status(404).json({ 'error': 'Order Not Found' });
            else
                res.status(200).json(result);
        }
        catch (error)
        {
            next({
                status: 500,
                data: { message: error?.message || 'Internal server error' }
            });
        }
    }

    // find all notes related to order
    static async getAllNotes(req, res, next)
    {
        try
        {
            const result = await NotesService.getAllNotes(req.params.orderGuid);

            if (!result)
                res.status(404).json({ 'error': 'Order Not Found' });
            else
                res.status(200).json(result);
        }
        catch (error)
        {
            next({
                status: 500,
                data: { message: error?.message || 'Internal server error' }
            });
        }
    }

    static async updateClientNote(req, res, next)
    {
        try
        {
            const order = await OrderService.updateClientNote(req.params.orderGuid, req.body, req.session.userGuid);
            res.status(202).json(order);
        }
        catch (error)
        {
            let status;
            if (error?.message == 'No order found')
            {
                status = 404;
            }
            next({
                status,
                data: { message: error?.message || 'Internal server error' }
            });
        }
    }

}

const controller = new OrderController();
module.exports = controller;