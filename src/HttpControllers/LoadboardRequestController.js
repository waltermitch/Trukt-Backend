const LoadboardRequestService = require('../Services/LoadboardRequestService');

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

    static async postcreateRequest(req, res, next)
    {
        try
        {
            const result = await LoadboardRequestService.createRequest(req?.body, req.session.userGuid);

            res.status(200);
            res.json(result);
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

    static async postcancelRequest(req, res, next)
    {
        try
        {
            await LoadboardRequestService.cancelRequests(req?.body, req.session.userGuid);

            res.status(200);
            res.json('Payload Canceled');
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