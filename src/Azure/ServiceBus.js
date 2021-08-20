const HTTPS = require('../AuthController');

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
            const token = await HTTPS.getSecret({ 'name': opts.tokenName });

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
}

module.exports = ServiceBus;