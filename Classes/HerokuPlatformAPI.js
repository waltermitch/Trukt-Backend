const AuthController = require('./AuthController');

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
        const res = await api.get(`/apps/${process.env['heroku.appId']}/config-vars`);

        return res.data;
    }

    static connect()
    {
        if (!api)
        {
            const opts =
            {
                url: 'https://api.heroku.com',
                headers:
                {
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${process.env['heroku.accessToken']}`
                }
            };

            // init
            api = new AuthController(opts).connect();
        }

        return api;
    }
}

module.exports = Heroku;