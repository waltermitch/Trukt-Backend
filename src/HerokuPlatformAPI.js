const AuthController = require('./AuthController');

let api;

class Heroku
{
    static async getConfig()
    {
        // ensure connection
        Heroku.connect();

        // search for config
        const res = await api.get(`/apps/${process.env['heroku.appId']}/config-vars`);

        if (res.data?.DATABASE_URL)
            return res.data;
        else
        {
            const keys = Object.keys(res.data);

            for (let i = 0; i < keys.length; i++)
                if (keys[i].includes('POSTGRESQL'))
                    return { 'DATABASE_URL': res.data[`${keys[i]}`] };
        }
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