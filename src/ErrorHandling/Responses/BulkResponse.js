const AppResponse = require('./AppResponse');

class BulkResponse
{
    /**
     * @private
     * @type {Record<string, AppResponse}
     */
    #errors;

    /**
     *
     * @param {string} [key] - Guid to identify the error collection
     * @param {AppResponse | unknown} [error] - Error to be added to the collection
     */
    constructor(key = undefined, error = undefined)
    {
        this.#errors = {};
        
        if (key && error)
            this.addError(key, error);
    }

    /**
     * @param {string} key - Guid to identify the error collection
     * @param {AppResponse | unknown} error - Error to be added to the collection
     * @returns {BulkResponse}
     */
    addError(key, error)
    {
        if (this.#errors[key] && this.#errors[key] instanceof AppResponse)
        {
            this.#errors[key].addError(error);
        }
        else if (!this.#errors[key] && error instanceof AppResponse)
        {
            this.#errors[key] = error;
        }
        else
        {
            this.#errors[key] = new AppResponse(error);
        }
        
        return this;
    }
    
    /**
     * @param {string} key
     * @param {number} status
     * @returns {BulkResponse}
     */
    setErrorCollectionStatus(key, status)
    {
        if (this.#errors[key] && this.#errors[key] instanceof AppResponse)
        {
            this.#errors[key].setStatus(status);
        }
        else
        {
            this.#errors[key] = new AppResponse();
            this.#errors[key].setStatus(status);
        }
        
        return this;
    }

    /**
     * @param {string} [guidKey] - if not provided, all errors will be returned
     * @returns {Record<string, unknown}
     */
    toJSON(guidKey = undefined)
    {
        if (guidKey)
            return this.#errors[guidKey].toJSON();

        const errors = Object.keys(this.#errors).reduce((errorsAcc, key) =>
        {
            errorsAcc[key] = this.#errors[key].toJSON();
            return errorsAcc;
        }, {});

        return errors;
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
        const exceptionCollections = Object.values(this.#errors);

        return exceptionCollections.some((collection) => collection.doErrorsExist());
    }

    /**
     * Get the error collection instance for a specific guid
     * @param {guid} key - Guid to identify the error collection
     * @returns {AppResponse}
     */
    getCollectionInstance(key)
    {
        return this.#errors[key];
    }
}

module.exports = BulkResponse;