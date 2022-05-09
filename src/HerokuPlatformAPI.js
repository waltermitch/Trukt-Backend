const HTTPS = require('./AuthController');

const herokuAccessToken = process.env.HEROKU_ACCESS_TOKEN;
const herokuAppId = process.env.HEROKU_APPID;
const herokuDatabaseCredName = process.env.HEROKU_DATABASE_CRED_NAME;
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
        const res = await api.get(`/apps/${herokuAppId}/config-vars`);

        if (herokuDatabaseCredName in res.data)
        {
            return { 'DATABASE_URL': res.data?.[herokuDatabaseCredName] };
        }
        else
        {
            throw Error(`Cannot connect to the databse with cred ${herokuDatabaseCredName}.`);
        }

    }
}

module.exports = Heroku;