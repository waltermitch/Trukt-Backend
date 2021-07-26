const { DateTime } = require('luxon');
const axios = require('axios');
const https = require('https');
const DB = require('./Mongo');

const jHeaders = { 'Content-Type': 'application/json' };

class HTTPController
{
    /* eslint-disable */
    constructor(data)
    {
        this.baseURL = data?.url;
        this.tokenName = data?.tokenName;
        this.instanceName = data?.name;
        this.headers = data?.headers;
        this.params = data?.params;
    }
    /* eslint-enable */

    async getSecret(query)
    {
        return await HTTPController.getSecret(query);
    }

    static async getSecret(query)
    {
        return await DB.getSecret(query);
    }

    async updateSecret(key, data)
    {
        return await DB.updateSecret(key, data);
    }

    connect()
    {
        this.instance = axios.create(
            {
                baseURL: this.baseURL,
                httpsAgent: new https.Agent({ keepAlive: true }),
                headers: (this?.headers || jHeaders),
                params: this?.params
            });

        return this.instance;
    }

    setToken(token)
    {
        // set Bearer Token
        this.setOAuthHeader(`Bearer ${token}`);
    }

    setOAuthHeader(value)
    {
        this.instance.defaults.headers.common['Authorization'] = value;
    }

    expCheck()
    {
        // check if exptime is up
        return (this.exp && this.exp > DateTime.utc().toString());
    }

    setExpTime(int)
    {
        // set the exp time
        this.exp = HTTPController.setExpTime(int);
    }

    static setExpTime(int)
    {
        // set the exp time
        return DateTime.utc().plus({ minutes: int }).toString();
    }
}

module.exports = HTTPController;