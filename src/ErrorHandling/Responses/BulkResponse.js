const AppResponse = require('./AppResponse');

class BulkResponse
{
    /**
     * @private
     * @type {Record<string, AppResponse}
     */
    #responses = {};

    /**
     *
     * @param {string} [key] - Guid to identify the error collection
     * @param {AppResponse | unknown} [error] - Error to be added to the collection
     */
    constructor(key = undefined, error = undefined)
    {
        if (key)
            this.addResponse(key, error);
    }

    /**
     * @param {string} key - Guid to identify the error collection
     * @param {AppResponse | Error | unknown} [error] - Error to be added to the collection
     * @returns {BulkResponse}
     */
    addResponse(key, error = undefined)
    {
        if (!this.#responses[key] && !error)
            this.#responses[key] = new AppResponse();
        else if (!this.#responses[key] && error instanceof AppResponse)
            this.#responses[key] = error;
        else if (this.#responses[key] && error instanceof AppResponse)
            this.#responses[key].combineResponse(error);
        else if (this.#responses[key] && error)
            this.#responses[key].addError(error);
        else
            this.#responses[key] = new AppResponse(error);

        return this;
    }

    /**
     * @returns {Record<string, AppResponse}
     */
    toJSON()
    {

        return this.#responses;
    }

    /**
     * @throws {BulkResponse}
     */
    throwErrorsIfExist()
    {
        if (this.doErrorsExist())
            throw this;
    }

    /**
     * @returns {boolean}
     */
    doErrorsExist()
    {
        const appResponses = Object.values(this.#responses);

        return appResponses.some((collection) => collection.doErrorsExist());
    }

    /**
     * Get the error collection instance for a specific guid
     * @param {guid} key - Guid to identify the error collection
     * @returns {AppResponse} AppResponse instance
     */
    getResponse(key)
    {
        return this.#responses[key];
    }
}

module.exports = BulkResponse;