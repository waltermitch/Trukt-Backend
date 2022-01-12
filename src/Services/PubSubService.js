const PubSub = require('../Azure/PubSub');

class PubSubService
{
    // use this method to propogate job updates
    // currently we are only passing in the status and the user who updated the job
    // eventually we should be passing the whole Order/OrderJob object
    static async jobUpdated(jobGuid, payload)
    {
        if (!jobGuid)
            throw new Error('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new Error('non-empty payload is required to publish to job updates to pubsub, received: ' + JSON.stringify(payload));

        const data =
        {
            'object': 'job',
            'data': payload
        };

        await PubSub.publishToGroup(jobGuid, data);
    }

    static async jobActivityUpdate(jobGuid, payload)
    {
        if (!jobGuid)
            throw new Error('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new Error('non-empty payload is required to publish to job updates to pubsub, received: ' + JSON.stringify(payload));

        const data =
        {
            'object': 'activity',
            'data': payload
        };

        await PubSub.publishToGroup(jobGuid, data);
    }

    static async publishJobPostings(jobGuid, payload)
    {
        if (!jobGuid)
            throw new Error('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new Error('non-empty payload is required to publish to job updates to pubsub, received: ' + JSON.stringify(payload));

        const data =
        {
            'object': 'posting',
            'data': payload
        };

        await PubSub.publishToGroup(jobGuid, data);
    }
}

module.exports = PubSubService;