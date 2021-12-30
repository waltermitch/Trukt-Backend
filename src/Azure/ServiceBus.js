const HTTPS = require('../AuthController');
const DB = require('../Mongo');

// config
const opts =
{
    url: process.env['azure.serviceBus.url'],
    tokenName: 'internal_service_bus_api_access_token'
};

// service bus singleton
let api;

class ServiceBus
{
    static async connect()
    {
        if (!api?.expCheck())
        {
            // get token
            const token = await DB.getSecret({ 'name': opts.tokenName });

            if (!api?.instance)
            {
                api = new HTTPS(opts);
                api.connect();
            }

            api.exp = token.exp;

            // set token
            api.setToken(token.value);
        }

        return api.instance;
    }

    static async push(SBName, data)
    {
        // connect
        const api = await ServiceBus.connect();

        // add message
        const res = await api.post(`${SBName}/messages`, data);

        return res.status;
    }

    static async pop(SBName)
    {
        const api = await ServiceBus.connect();

        const res = await api.delete(`${SBName}/messages/head`);

        return res;
    }

    // batch promises to get many messages
    static async popMany(SBName, count)
    {
        // map promises
        const promises = [];

        for (let i = 0; i < count; i++)
            promises.push({ func: ServiceBus.pop, args: [SBName] });

        // get messages
        const res = await Promise.all(promises.map(p => p.func(...p.args)));

        return res;
    }
}

module.exports = ServiceBus;