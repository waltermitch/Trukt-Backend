const { delay, isServiceBusError, ServiceBusClient } = require('@azure/service-bus');

const connectionString = process.env['azure.servicebus.connectionString'];

const serviceBusClient = new ServiceBusClient(connectionString);

class ServiceBus
{
    constructor({ queue, topic, subscription, receiveMode })
    {
        if (queue)
            this.buildQueue(queue, receiveMode);
        else if (topic && subscription)
            this.buildTopic(topic, subscription);
    }

    buildQueue(queue, receiveMode = 'receiveAndDelete')
    {
        this.receiver = serviceBusClient.createReceiver(queue, { receiveMode });
        this.sender = serviceBusClient.createSender(queue);
    }

    buildTopic(topic, subscription)
    {
        // whoever uses this can implement it
        // i don't like this approach because system gets spammed with messages potentially
    }

    async getMessages(amount = 1)
    {
        const res = await this.receiver.receiveMessages(amount);

        return res.map((e) => e.body);
    }

    async batchSend(messages = [], contentType = 'application/json')
    {
        // make sure its an array
        if (!Array.isArray(messages))
            messages = [messages];

        // return if length is 0
        if (messages.length === 0)
            return;

        let batch = await this.sender.createMessageBatch();

        for (const msg of messages)
        {
            const payload = { body: msg, contentType };
            if (!batch.tryAddMessage(payload))
            {
                await this.sender.sendMessages(batch);
                batch = await this.sender.createMessageBatch();

                if (!batch.tryAddMessage(payload))
                    throw new Error('Failed to add message to batch');
            }
        }

        // send the last batch
        await this.sender.sendMessages(batch);
    }

    async subscriptionMessageHandler(message)
    {
        // can expand this later;
        if (message.body)
            return message.body;
    }

    async subscriptionErrorHandler(args)
    {
        // copy pasted this from LoadboardHandler.js
        console.log(`Error occurred with ${args.entityPath} within ${args.fullyQualifiedNamespace}: `, args.error);

        if (isServiceBusError(args.error))
        {
            switch (args.error.code)
            {
                case 'MessagingEntityDisabled':
                case 'MessagingEntityNotFound':
                case 'UnauthorizedAccess':
                    // It's possible you have a temporary infrastructure change (for instance, the entity being
                    // temporarily disabled). The handler will continue to retry if `close()` is not called on the subscription - it is completely up to you
                    // what is considered fatal for your program.
                    console.log(`An unrecoverable error occurred. Stopping processing. ${args.error.code}`, args.error);
                    await this.subscription.close();
                    break;
                case 'MessageLockLost':
                    console.log('Message lock lost for message', args.error);
                    break;
                case 'ServiceBusy':
                    // choosing an arbitrary amount of time to wait.
                    await delay(1000);
                    break;
            }
        }
    }
}

module.exports = ServiceBus;