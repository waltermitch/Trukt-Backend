const HTTPS = require('../AuthController');

const baseURL = process.env.AZURE_GENERALFUNC_BASEURL;
const code = process.env.AZURE_GENERALFUNC_CODE;

const api = new HTTPS({ url: baseURL, params: { code } }).connect();

class GeneralFunctions
{
    static async calculateDistance(stops)
    {
        // sending requrest to General Fun API
        const { data } = await api.post('/calculateDistance', stops);

        // returning distance only
        return data.data;
    }
}

module.exports = GeneralFunctions;