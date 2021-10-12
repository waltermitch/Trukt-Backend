const axios = require('axios');

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
            baseURL: process.env['azure.generalFunc.baseurl'],
            headers: { 'Content-Type': 'application/json' },
            params: { code: process.env['azure.generalFunc.funcCode'] }
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