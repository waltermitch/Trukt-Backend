const LoadboardRequestService = require('../Services/LoadboardRequestService');
const LoadboardRequest = require('../Models/LoadboardRequest');
const { NotFoundError, MissingDataError } = require('../ErrorHandling/Exceptions');

class LoadboardRequestController
{
    static async getByJobGuid(req, res, next)
    {
        try
        {
            const result = await LoadboardRequestService.getbyJobID(req?.params?.jobGuid);
    
            if (result.length)
            {
                res.status(200);
                res.json(result);
            }
            else
                throw new NotFoundError('');
        }
        catch (error)
        {
            next(error);
        }
    }

    static async createRequestFromIncomingWebHook(req, res, next)
    {
        try
        {
            const externalPost = { guid: req.body.extraExternalData.externalOrderID };
            const carrier = {
                guid: req.body.extraExternalData.carrierInfo.guid,
                usDot: req.body.carrierIdentifier,
                name: req.body.extraExternalData.carrierInfo.name
            };
            const requestModel = LoadboardRequest.fromJson(req.body);
            const result = await LoadboardRequestService.createRequestfromWebhook(requestModel, externalPost, carrier, req.session.userGuid);

            res.status(200);
            res.json({ status: 200, data: result });
        }
        catch (err)
        {
            next(err);
        }
    }

    static async cancelRequestFromIncomingWebHook(req, res, next)
    {
        try
        {
            const externalPost = { guid: req.body?.extraExternalData?.externalOrderID };
            const carrier = {
                guid: req.body.extraExternalData.carrierInfo.guid,
                usDot: req.body.carrierIdentifier,
                name: req.body.extraExternalData.carrierInfo.name
            };
            const requestModel = LoadboardRequest.fromJson(req.body);
            const result = await LoadboardRequestService.cancelRequestfromWebhook(requestModel, externalPost, carrier, req.session.userGuid);

            res.status(200);
            res.json({ status: 200, data: result });
        }
        catch (err)
        {
            next(err);
        }
    }

    static async acceptLoadRequest(req, res, next)
    {
        try
        {
            if (req?.params?.requestGuid)
            {
                const result = await LoadboardRequestService.acceptRequest(req?.params?.requestGuid, req.session.userGuid);

                res.status(200);
                res.json(result);
            }
            else
                throw new MissingDataError('Unable to accept Request, missing requestGuid');
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
                await LoadboardRequestService.declineRequest(req?.params?.requestGuid, req.body, req.session.userGuid);
                res.status(204).send();
            }
            else
                throw new MissingDataError('Unable to decline Request, missing requestGuid');
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = LoadboardRequestController;