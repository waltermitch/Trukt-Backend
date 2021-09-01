const LoadboardRequestService = require('../Services/LoadboardRequestService');
const HttpRouteController = require('./HttpRouteController');
const Super = require('../Loadboards/SuperDispatch');
const ShipCars = require('../Loadboards/ShipCar');

class LoadboardRequestController extends HttpRouteController
{
    static async getByJobGuid(req, res, next)
    {
        const result = await LoadboardRequestService.getbyJobID(req?.params?.jobGuid);
        if (result)
        {
            res.status(200);
            res.json(result);
        }
        else
        {
            res.status(404).send();
        }
    }

    static async postcreateRequest(req, res, next)
    {
        // uuidRegex.test(req?.body)
        if (req?.body)
        {
            const result = await LoadboardRequestService.createRequest(req?.body);
            res.status(200);
            res.json(result);
        }
        else
        {
            res.status(400);
            res.send('Unable to create Request');
        }
    }

    static async postcancelRequest(req, res, next)
    {
        // TODO: Move SUPER to this level
        // uuidRegex.test(req?.body)
        if (req?.body)
        {
            const result = await LoadboardRequestService.cancelRequests(req?.body);
            res.status(200);
            res.json(result);
        }
        else
        {
            res.status(400);
            res.send('Unable to cancel Request');
        }
    }

    // add function to accept and decline request
    static async declineLoadRequest(req, res, next)
    {
        if (req?.body)
        {
            const result = await LoadboardRequestService.declineRequest(req?.query?.param, req.body);
            res.status(200);
            res.status(result);
        }
        else
        {
            res.status(400);
            res.send('Unable to decline Request');
        }
    }

    static async acceptLoadRequest(req, res, next)
    {
        if (req?.query?.param)
        {
            // handle HTTP calls
            const result = await LoadboardRequestService.acceptRequest(req?.query?.param, req.body);
            res.status(200);
            res.status(result);
        }
        else
        {
            res.status(400);
            res.send('Unable to accept Request');
        }
    }

}

const controller = new LoadboardRequestController();

module.exports = controller;