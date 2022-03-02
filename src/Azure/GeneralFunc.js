const HTTPS = require('../AuthController');

const baseURL = process.env.AZURE_GENERALFUNC_BASEURL;
const code = process.env.AZURE_GENERALFUNC_CODE;

const api = new HTTPS({ url: baseURL, params: { code } }).connect();

class GeneralFunctions
{
    static async calculateDistances(object)
    {
        // sending requrest to General Fun API
        const { data } = await api.post('/calculateDistance', object);

        // returning distance only
        return data.data;
    }
}

module.exports = GeneralFunctions;