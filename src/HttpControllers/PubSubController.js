const PubSub = require('../Azure/PubSub');

class PubSubController
{
    static async get(req, res, next)
    {
        try
        {
            const result = await PubSub.getSubToken(req.session.userGuid);
    
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