const HTTPController = require('./HTTPController');

let api;

class Heroku
{
    constructor()
    { }

    static async getConfig()
    {
        // ensure connection
        Heroku.connect();

        // search for config
        const res = await api.get(`/apps/${config.heroku.appId}/config-vars`);

        return res.data;
    }

    static connect()
    {
        if (!api?.expCheck())
        {
            const opts =
            {
                url: 'https://api.heroku.com',
                headers:
                {
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.heroku+json; version=3'
                }
            };

            // init
            api = new HTTPController(opts);

            // connect
            api.connect();

            // set token
            api.setToken(process.env.herokuAccessToken);

            // set instance
            api = api.instance;
        }
    }
}

module.exports = Heroku;