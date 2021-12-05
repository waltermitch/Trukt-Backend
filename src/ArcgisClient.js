
const axios = require('axios');
const https = require('https');

const API_KEY = process.env['arcgis.apikey'];
const BASE_URL = process.env['arcgis.baseUrl'];
const NODE_ENV = process.env.NODE_ENV;

class ArcgisClient
{
    constructor(keepAlive = false)
    {
        this.client = axios.create(
            {
                baseURL: BASE_URL,
                httpsAgent: new https.Agent({ keepAlive })
            });
        this.tokenPath = NODE_ENV != 'local' ? `&token=${API_KEY}` : '';
        this.findAddressPath = '/findAddressCandidates';
        this.score = 95;
    }

    /**
     *
     * @param {*} address String with the address to check
     * @param {*} options.limit Number of candidates to return, arcgis may return an array in case
     * there are multiple candidates. If limit is 1 then a single object is returned, otherwise an array
     * of objects is returned. Default to 1
     * @param {*} options.score Filter the possible candidantes by a confidence percentage and returns
     * the ones that has higher score. Default to 95
     * @returns
     */
    async findGeocode(address, { limit = 1, score = this.score } = {})
    {
        const url = `${this.findAddressPath}?f=json&address=${address}${this.tokenPath}`;
        try
        {
            const response = await this.client.get(url);
            const arcgisData = this.parseResponse(response);
            const candidates = arcgisData?.candidates || [];

            if (limit === 1)
                return candidates?.find(candidate => candidate.score >= score) || {};

            const candidatesFulfillScore = candidates?.filter(candidate => candidate?.score >= score);
            return candidatesFulfillScore.slice(0, limit);
        }
        catch (error)
        {
            console.error(`Arcgis Error: ${error?.message}`);
            return {};
        }
    }

    parseResponse(response)
    {
        if (response?.status === 200 && !response.data?.error)
            return response.data;
        throw {
            message: response.data?.error?.message
        };
    }

    isSetuped()
    {
        return API_KEY && BASE_URL ? true : false;
    }

    isAddressFound(arcgisAddress)
    {
        const { location } = arcgisAddress;

        if (location?.x && location?.y)
            return true;
        return false;
    }

    getCoordinatesFromTerminal(arcgisTerminal)
    {
        return {
            latitude: parseFloat(arcgisTerminal.location.y).toFixed(7),
            longitude: parseFloat(arcgisTerminal.location.x).toFixed(7)
        };
    }

}

module.exports = new ArcgisClient(true);