const PubSub = require('../Azure/PubSub');

class Handler
{
    static async jobStatusChanged(data)
    {
        // send to group
        await PubSub.publishToGroup(data.guid, { 'object': 'job', 'data': data });
    }
}

module.exports = Handler;