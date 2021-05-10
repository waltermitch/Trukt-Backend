const HTTPController = require('../Classes/HTTPController');
const DB = require('../Classes/Mongo');
const { DateTime } = require('luxon');
const qs = require('qs');

let api;

class Heroku
{
    constructor()
    { }

    static async getConfig()
    {
        // connect
        const heroku = await Heroku.connect();

        // search for config
        const res = await heroku.get(`/apps/${config.heroku.appId}/confning-vars`);

        return res.data;
    }

    static async connect()
    {
        if (!api.expCheck())
        {
            const opts =
            {
                url: 'https://api.heroku.com',
                tokenName: config.heroku.accessToken
            };

            const token = await DB.getSecret({ 'name': opts.tokenName });

            if (!api?.instance)
            {
                api = new HTTPController(opts);

                api.connect();
            }

            api.setToken(token.value);
        }

        return api.instance;
    }

    static async getNewToken()
    {
        const payload = qs.stringify(
            {
                'refresh_token': config.heroku.refreshToken,
                'grant_type': 'refresh_token',
                'client_secret': config.heroku.clientSecret
            });

        // get auth connection
        const auth = new HTTPController({ 'url': 'https://id.heroku.com' }).connect();

        // get new token
        const res = await auth.post('/oauth/token', payload, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        // compose payload
        const update = { 'value': res.data.access_token, 'exp': DateTime.utc().plus({ hours: 7 }).toString() };

        // update in db
        await DB.updateSecret(config.heroku.accessToken, update);

        return { 'status': 200 };
    }
}

module.exports = Heroku;