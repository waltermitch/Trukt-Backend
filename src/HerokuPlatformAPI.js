const Axios = require('axios');
const https = require('https');

const baseURL = 'https://api.heroku.com';
const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.heroku+json; version=3',
    'Authorization': `Bearer ${process.env['heroku.accessToken']}`
};

// Stores the active axios http client
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

    static connect(opts)
    {
        // Client doesnt need to keep-alive because fetching only the config and thats it.
        if (!api)
        {
            api = Axios.create({
                baseURL,
                headers,
                httpsAgent: new https.Agent(opts)
            });
        }

        return api;
    }
}

module.exports = Heroku;