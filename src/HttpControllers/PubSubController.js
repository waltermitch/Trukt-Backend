const PubSub = require('../Azure/PubSub');

class PubSubController
{
    static async get(req, res)
    {
        const result = await PubSub.getSubToken(req.session.user.oid);

        if (result)
        {
            res.status(200);
            res.json(result);
        }
    }
}

module.exports = PubSubController;