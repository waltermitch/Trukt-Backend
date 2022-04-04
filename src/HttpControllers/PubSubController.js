const PubSubService = require('../Services/PubSubService');

class PubSubController
{
    static async get(req, res, next)
    {
        try
        {
            const result = await PubSubService.getAuthToken(req.session.userGuid);

            if (result)
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
}

module.exports = PubSubController;