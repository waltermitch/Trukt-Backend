const axios = require('axios');
const EDIError = require('../ErrorHandling/Exceptions/EDIError');

class EDIApi
{
    constructor()
    {
        // lapp => logic app
        this.lapp214 = axios.create({
            baseURL: process.env.EDI_214_LOGICAPP_URL,
            headers: { 'Content-Type': 'application/json' }
        });
        this.lapp204 = axios.create({
            baseURL: process.env.EDI_204_LOGICAPP_URL,
            headers: { 'Content-Type': 'application/json' }
        });
        this.lapp990 = axios.create({
            baseURL: process.env.EDI_990_LOGICAPP_URL,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    #checkIfAllowed()
    {
        // we want the EDI_FUNCTIONALITY to only be set to true and no other truthy values.
        // JSON true value gets changed to "true" string
        if (!(process.env.EDI_ENABLED === 'true' || process.env.EDI_ENABLED === true))
        {
            throw new EDIError('EDI functionality is not enabled in this app.');
        }
    }

    /**
     * @description Creates an HttpRequest promise with the given payload
     * @param {EDI214Payload} payload
     * @returns
     */
    send214(payload)
    {
        this.#checkIfAllowed();
        return this.lapp214.post('', payload);
    }

    /**
     * @description Creates an HttpRequest promise with the given payload
     * @param {EDI204Payload} payload
     * @returns Promise
     */
    send204(payload)
    {
        this.#checkIfAllowed();
        return this.lapp204.post('', payload);
    }

    /**
     * @description Creates an HttpRequest promise with the given payload
     * @param {EDI990Payload} payload
     * @returns
     */
    send990(payload)
    {
        this.#checkIfAllowed();
        return this.lapp990.post('', payload);
    }

    handleError(error)
    {
        let ediError;
        if (error.response)
        {
            ediError = new EDIError(JSON.stringify(error.response.data));
            ediError.addRequest(error.request);
            ediError.addResponse(error.response);
            throw ediError;
        }
        else if (error.request)
        {
            ediError = new EDIError('No response received');
            ediError.addRequest(error.request);
            throw ediError;
        }
        else
        {
            throw error;
        }
    }

}

const singleton = new EDIApi();

module.exports = singleton;