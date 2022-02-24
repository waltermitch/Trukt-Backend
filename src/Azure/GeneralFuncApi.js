const axios = require('axios');

const baseURL = process.env.AZURE_GENERALFUNC_BASEURL;
const code = process.env.AZURE_GENERALFUNC_CODE;

class GeneralFunctionsApi
{
    constructor()
    {
        // super(...args);
        // this.defaults.baseURL = Url;
        // this.headers = { 'Content-Type': 'application/json' };
        // this.params = param;
    }

    // creating instance object
    static createConnectionObject()
    {
        return axios.create({
            baseURL,
            headers: { 'Content-Type': 'application/json' },
            params: { code }
        });
    }

    static async calculateDistances(object)
    {
        // getting instance for function call
        const generalApi = await GeneralFunctionsApi.createConnectionObject();

        // sending requrest to General Fun API
        const response = await generalApi.post('/calculateDistance', object);

        // returning distance only
        return response.data.data;
    }
}

module.exports = GeneralFunctionsApi;

// const https = require('https');
// httpsAgent: new https.Agent({ keepAlive: true }),