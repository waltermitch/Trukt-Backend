const LoadboardRequestService = require('../Services/LoadboardRequestService');
const LoadboardRequest = require('../Models/LoadboardRequest');

class LoadboardRequestController
{
    static async getByJobGuid(req, res)
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
            if (err.message == 'Posting Doesn\'t Exist')
            {
                res.status(404);
                res.json(err.message);
            }
            else
            {
                next(err);
            }
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
            if (err.message == 'Posting Doesn\'t Exist')
            {
                res.status(404);
                res.json(err.message);
            }
            else
            {
                next(err);
            }
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
            const reason = req?.body.reason;
            const requestGuid = req.params?.requestGuid;
            if (!reason)
            {
                // TODO: Update error with proper ErrorHandler
                throw new Error('Unable to decline Request, missing reason');
            }
            await LoadboardRequestService.declineRequest(requestGuid, reason, req.session.userGuid);
            res.status(204).send();
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = LoadboardRequestController;