const { MissingDataError } = require('../ErrorHandling/Exceptions');
const { WebPubSubServiceClient } = require('@azure/web-pubsub');

const connectionString = process.env.AZURE_PUBSUB_CONNECTIONSTRING;
const hubName = process.env.AZURE_PUBSUB_HUB;

const service = new WebPubSubServiceClient(connectionString, hubName, { keepAliveOptions: { enable: true } });

class PubSub
{
    static async getSubToken(userId)
    {
        const token = await service.getClientAccessToken({ userId, roles: ['webpubsub.joinLeaveGroup'], expirationTimeInMinutes: 1440 });

        return token;
    }

    static async publishToGroup(data, object, parent = {})
    {
        // data is always required
        if (!data)
            throw new MissingDataError('data property is required to publish to pubsub');

        // generic structure for all messages
        const message =
        {
            metadata:
            {
                object,
                parent
            },
            data
        };

        // our group name is the same as the hub name
        await service.group(hubName).sendToAll(message);
    }
}

module.exports = PubSub;