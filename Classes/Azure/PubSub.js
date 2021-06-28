const { WebPubSubServiceClient } = require('@azure/web-pubsub');

const connectionString = process.env['azure.pubsub.connectionString'];
const hubName = process.env['azure.pubsub.hub'];

const service = new WebPubSubServiceClient(connectionString, hubName, { keepAliveOptions: { enable: true } });

class PubSub 
{
    static async getSubToken(groupName, userId)
    {
        const token = await service.getAuthenticationToken({ roles: [`webpubsub.joinLeaveGroup.${groupName}`], userId: userId, 'ttl': 1440 });

        return token;
    }

    static async publishToGroup(groupName, message)
    {
        await service.group(groupName).sendToAll(message);
    }
}

module.exports = PubSub;