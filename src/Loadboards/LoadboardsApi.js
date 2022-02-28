const axios = require('axios');

class LoadboardsApi
{
    constructor()
    {
        this.loadboard = axios.create({
            baseURL: process.env.AZURE_LOADBOARD_BASEURL,
            headers: { 'Content-Type': 'application/json' },
            params: { code: process.env.AZURE_LOADBOARD_FUNCCODE }
        });
    }

    /**
     * Creates an HttpRequest promise with provided payload.
     * @param {LoadboardPost} payload
     * @returns Promise
     */
    sendUnPost(payload)
    {
        return this.loadboard.post('/unPostLoads', payload);
    }

    /**
     * Creates an HttpRequest promise with provided payload.
     * @param {Request} payload
     * @returns Promise
     */
    sendRequest(payload)
    {
        return this.loadboard.post('/incomingLoadboardRequest', payload);
    }
}

const singleton = new LoadboardsApi();

module.exports = singleton;