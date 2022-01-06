const HTTPS = require('./AuthController');

const herokuAccessToken = process.env['heroku.accessToken'];
const opts =
{
    url: 'https://api.heroku.com',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.heroku+json; version=3',
        'Authorization': `Bearer ${herokuAccessToken}`
    }
};

const api = new HTTPS(opts).connect(false);

class Heroku
{
    static async getConfig()
    {
        // search for config
        const res = await api.get(`/apps/${process.env['heroku.appId']}/config-vars`);

        if (res.data?.DATABASE_URL)
        {
            return res.data;
        }
        else
        {
            // The returned object will have multiple connections strings.
            // The database credentials are always going to rotate so the key is unknown at all times.
            // What is known is that POSTGRESQL will appear in the key somewhere.
            for (const key of Object.keys(res.data))
            {
                if (key.includes('POSTGRESQL'))
                {
                    return { 'DATABASE_URL': res.data[key] };
                }
            }
        }
    }
}

module.exports = Heroku;