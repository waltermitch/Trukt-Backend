const PubSub = require('../Azure/PubSub');

class PubSubController
{
    static async get(req, res)
    {
        if (!req.query.groupName)
            throw { 'status': 400, 'data': 'Missing GroupName' };

        const result = await PubSub.getSubToken(req.query.groupName, req.session.userId);

        if (result)
        {
            res.status(200);
            res.json(result);
        }
    }
}

module.exports = PubSubController;