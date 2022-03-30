const PubSub = require('../Azure/PubSub');
const { MissingDataError } = require('../ErrorHandling/Exceptions');

class PubSubService
{
    // use this method to propogate job updates
    // currently we are only passing in the status and the user who updated the job
    // eventually we should be passing the whole Order/OrderJob object
    static async jobUpdated(jobGuid, payload)
    {
        if (!jobGuid)
            throw new MissingDataError('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new MissingDataError('non-empty payload is required to publish to job updates to pubsub', { payload });

        const object =
        {
            'name': 'job',
            'guid': jobGuid
        };

        await PubSub.publishToGroup(payload, object);
    }

    static async jobActivityUpdate(jobGuid, payload)
    {
        if (!jobGuid)
            throw new MissingDataError('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new MissingDataError('non-empty payload is required to publish to job updates to pubsub', { payload });

        const { parent, object } = PubSubService.buildObjectAndParent(jobGuid, 'job', 'activity', payload);

        await PubSub.publishToGroup(payload, object, parent);
    }

    static async publishJobPostings(jobGuid, payload)
    {
        if (!jobGuid)
            throw new MissingDataError('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new MissingDataError('non-empty payload is required to publish to job updates to pubsub ', { payload });

        const { parent, object } = PubSubService.buildObjectAndParent(jobGuid, 'job', 'posting', payload);

        await PubSub.publishToGroup(payload, object, parent);
    }

    static async publishJobRequests(jobGuid, payload)
    {
        if (!jobGuid)
            throw new MissingDataError('jobGuid is required to publish to job updates to pubsub');
        else if (Object.keys(payload).length === 0)
            throw new MissingDataError('non-empty payload is required to publish to job updates to pubsub, received: ' + JSON.stringify(payload));

        const { parent, object } = PubSubService.buildObjectAndParent(jobGuid, 'job', 'request', payload);

        await PubSub.publishToGroup(payload, object, parent);
    }

    // here we use parentGuid because sometimes its a job guid and sometimes it's an order guid
    static async publishNote(parentGuid, parentName, payload, action)
    {
        if (!parentGuid || !parentName)
            throw new MissingDataError('parentGuid and parentName are required to publish to note updates to pubsub');

        const { object, parent } = PubSubService.buildObjectAndParent(parentGuid, parentName, 'note', payload);

        // set the action on the object (created, updated, deleted)
        object.action = action;

        await PubSub.publishToGroup(payload, object, parent);
    }

    static buildObjectAndParent(parentGuid, parentName, objectName, objectInfo)
    {
        const parent =
        {
            'name': parentName,
            'guid': parentGuid
        };

        const object =
        {
            'name': objectName,
            'guid': objectInfo.guid
        };

        return { parent, object };
    }
}

module.exports = PubSubService;