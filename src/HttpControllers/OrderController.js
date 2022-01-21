const OrderService = require('../Services/OrderService');
const NotesService = require('../Services/NotesService');
const emitter = require('../EventListeners/index');
const Order = require('../Models/Order');

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

            if (!order?.isTender)
                emitter.emit('order_created', order.guid);

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

    // TODO: FOR SINGLE ACCEPT NOT USED YET
    static async handleTender(req, res, next)
    {
        const orderGuid = req.params.orderGuid;
        try
        {
            let result;
            if (req.params.action == 'accept')
            {
                result = await OrderService.acceptLoadTenders([orderGuid], req.session.userGuid);
            }
            else if (req.params.action == 'reject')
            {
                result = await OrderService.rejectLoadTenders([orderGuid], req.body.reason, req.session.userGuid);
            }
            if (result[`${orderGuid}`].status === 404 || result[`${orderGuid}`].status === 400)
            {
                res.status(result[`${orderGuid}`].status);
                res.json(result);
            }
            else
            {
                res.status(200);
                res.json(result);
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    // FIXME: CURRENTLY USED for both BULK and Single
    static async handleTenders(req, res, next)
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

    static async patchOrder(req, res, next)
    {
        try
        {
            const { body } = req;
            const oldOrder = await Order.query().findById(body.guid).skipUndefined().withGraphJoined(Order.fetch.stopsPayload);
            const order = await OrderService.patchOrder(body, req.session.userGuid);

            // register this event
            emitter.emit('order_updated', { oldOrder: oldOrder, newOrder: order });

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

            // emit event order_updated
            emitter.emit('order_client_notes_updated', req.params.orderGuid);

            res.status(202).json(order);
        }
        catch (error)
        {
            let status;
            if (error?.message == 'No order found')
                status = 404;

            next({
                status,
                data: { message: error?.message || 'Internal server error' }
            });
        }
    }

    static async putOrderOnHold(req, res)
    {
        const result = await OrderService.markOrderOnHold(req.params.orderGuid, req.session.userGuid);

        if (result)
            res.status(200).json(result);
    }

    static async removeHoldOnOrder(req, res, next)
    {
        try
        {
            const result = await OrderService.removeHoldOnOrder(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async markOrderComplete(req, res, next)
    {
        try
        {
            const result = await OrderService.markOrderComplete(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async markOrderUncomplete(req, res, next)
    {
        try
        {
            const result = await OrderService.markOrderUncomplete(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async deleteOrder(req, res, next)
    {
        try
        {
            const result = await OrderService.deleteOrder(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async undeleteOrder(req, res, next)
    {
        try
        {
            const result = await OrderService.undeleteOrder(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async markOrderDelivered(req, res, next)
    {
        try
        {
            const result = await OrderService.markOrderDelivered(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async markOrderUndelivered(req, res, next)
    {
        try
        {
            const result = await OrderService.markOrderUndelivered(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async cancelOrder(req, res, next)
    {
        try
        {
            const result = await OrderService.cancelOrder(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async uncancelOrder(req, res, next)
    {
        try
        {
            const result = await OrderService.uncancelOrder(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }

}

module.exports = OrderController;