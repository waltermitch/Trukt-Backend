const PubSub = require('../Azure/PubSub');

class TempController
{
    static async post(req, res)
    {
        try
        {
            await PubSub.publishToGroup(req.body.groupId, req.body.message);
        }
        catch (err)
        {
            console.log(err);
        }

        res.status(200).send('OK');
    }
}

module.exports = TempController;