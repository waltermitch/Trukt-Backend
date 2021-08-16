const OrderService = require('../Services/OrderService');
const HttpRouteController = require('./HttpRouteController');

const { MilesToMeters } = require('./../Utils');

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
            const order = await OrderService.create(req.body, req.session.userGuid);
            res.status(200);
            res.json(order);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async getOrders(req, res, next)
    {
        const userInputValidated = OrderController.validateInput(req.query);

        if (!userInputValidated)
        {
            next({
                status: 400,
                data: { message: 'Invalid user input' }
            });
        }
        else
        {
            try
            {
                const {
                    page,
                    rowCount,
                    originLatitude,
                    originLongitude,
                    originRadius,
                    destinationLatitude,
                    destinationLongitude,
                    destinationRadius } = userInputValidated;

                const origin = originLatitude && originLongitude && {
                    latitude: originLatitude,
                    longitude: originLongitude,
                    radius: MilesToMeters(originRadius || 1)
                };

                const destination = destinationLatitude && destinationLongitude && {
                    latitude: destinationLatitude,
                    longitude: destinationLongitude,
                    radius: MilesToMeters(destinationRadius || 1)
                };

                const orders = await OrderService.getOrders({ origin, destination }, page || 0, rowCount || 25);

                res.status(200);
                res.json(orders);
            }
            catch (error)
            {
                next({
                    status: 500,
                    data: { message: error?.nativeError?.hint || 'Internal server error' }
                });
            }

        }

    }

    static validateInput({
        pg,
        rc,
        originLatitude,
        originLongitude,
        originRadius,
        destinationLatitude,
        destinationLongitude,
        destinationRadius
    })
    {
        const result = {
            page: pg && parseInt(pg),
            rowCount: rc && parseInt(rc),
            originLatitude: originLatitude && parseFloat(originLatitude),
            originLongitude: originLongitude && parseFloat(originLongitude),
            originRadius: originRadius && parseInt(originRadius),
            destinationLatitude: destinationLatitude && parseFloat(destinationLatitude),
            destinationLongitude: destinationLongitude && parseFloat(destinationLongitude),
            destinationRadius: destinationRadius && parseInt(destinationRadius)
        };

        const isAnyValueNaN = Object.values(result).some((value) => isNaN(value === undefined ? null : value));

        return isAnyValueNaN ? false : result;

    }
}

const controller = new OrderController();
module.exports = controller;