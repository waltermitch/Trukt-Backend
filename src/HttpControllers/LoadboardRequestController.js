const LoadboardRequestService = require('../Services/LoadboardRequestService');
const HttpRouteController = require('./HttpRouteController');

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
        try
        {

            const result = await LoadboardRequestService.createRequest(req?.body);
            res.status(200);
            res.json(result);
        }
        catch (err)
        {
            if (err.message == 'Posting Doesn\'t Exist')
            {
                console.log(err.message);
                res.status(404);
                res.json(err.message);
            }
            else
            {
                next(err);
            }
        }
    }

    static async postcancelRequest(req, res, next)
    {
        try
        {
            await LoadboardRequestService.cancelRequests(req?.body);
            res.status(200);
            res.json('Payload Canceled');
        }
        catch (error)
        {
            res.status(400);
            res.send(error);
        }
    }

    static async acceptLoadRequest(req, res, next)
    {
        try
        {
            if (req?.params?.requestGuid)
            {
                const result = await LoadboardRequestService.acceptRequest(req?.params?.requestGuid);
                res.status(200);
                res.status(result);
            }
            else
            {
                res.status(400);
                res.send('Unable to accept Request or no Guid');
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async declineLoadRequest(req, res, next)
    {
        try
        {
            if (req?.body)
            {
                const result = await LoadboardRequestService.declineRequest(req?.params?.requestGuid, req.body);
                res.status(200);
                res.status(result);
            }
            else
            {
                res.status(400);
                res.send('Unable to decline Request, missing reason');
            }
        }
        catch (error)
        {
            next(error);
        }
    }

}

const controller = new LoadboardRequestController();

module.exports = controller;