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

    static async publishToGroup(groupName, message)
    {
        await service.group(groupName).sendToAll(message);
    }
}

module.exports = PubSub;