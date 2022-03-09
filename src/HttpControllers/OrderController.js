const OrderService = require('../Services/OrderService');
const NotesService = require('../Services/NotesService');
const emitter = require('../EventListeners/index');
const { NotFoundError, MissingDataError } = require('../ErrorHandling/Exceptions');

class OrderController
{
    static async getOrder(req, res, next)
    {
        try
        {
            if (req.params.orderGuid)
            {
                const orderPayload = await OrderService.getOrderByGuid(req.params.orderGuid);

                if (orderPayload)
                {
                    res.status(200);
                    res.json(orderPayload);
                }
                else
                    throw new NotFoundError('Order not found');
            }
            else
                throw new MissingDataError('Order guid is missing');
        }
        catch (err)
        {
            next(err);
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

    static async handleTender(req, res, next)
    {
        const action = req.params.action;
        const currentUser = req.session.userGuid;
        const orderGuids = [req.params.orderGuid];
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
            const response = bulkResponse.getResponse(orderGuids[0]);
            const jsonResponse = response.toJSON();

            res.status(jsonResponse.status);
            res.json(jsonResponse);
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
            next(error);
        }
    }

    // find notes only related to order
    static async getOrderNotes(req, res, next)
    {
        try
        {
            const result = await NotesService.getOrderNotes(req.params.orderGuid);

            if (!result)
                throw new NotFoundError('Order not found');
            else
                res.status(200).json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    // find all notes related to order
    static async getAllNotes(req, res, next)
    {
        try
        {
            const result = await NotesService.getAllNotes(req.params.orderGuid);

            if (!result)
                throw new NotFoundError('Order not found');
            else
                res.status(200).json(result);
        }
        catch (error)
        {
            next(error);
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
            next(error);
        }
    }

    static async putOrderOnHold(req, res, next)
    {
        try
        {
            const result = await OrderService.markOrderOnHold(req.params.orderGuid, req.session.userGuid);

            if (result)
                res.status(200).json(result);
            else
                throw new NotFoundError('Order not found');
        }
        catch (error)
        {
            next(error);
        }
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