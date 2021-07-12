const PubSub = require('../Azure/PubSub');

class EventManager
{
    static async jobStatusChanged(data)
    {
        // send to group
        await PubSub.publishToGroup(data.guid, data);
    }
}

module.exports = EventManager;