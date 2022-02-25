const ExceptionCollection = require('./ExceptionCollection');

class BulkException
{
    /**
     * @private
     * @type {Record<string, ExceptionCollection}
     */
    #errors;

    /**
     *
     * @param {string} [key] - Guid to identify the error collection
     * @param {ExceptionCollection | unknown} [error] - Error to be added to the collection
     */
    constructor(key = undefined, error = undefined)
    {
        this.#errors = {};
        
        if (key && error)
            this.addError(key, error);
    }

    /**
     * @param {string} key - Guid to identify the error collection
     * @param {ExceptionCollection | unknown} error - Error to be added to the collection
     * @returns {BulkException}
     */
    addError(key, error)
    {
        if (this.#errors[key] && this.#errors[key] instanceof ExceptionCollection)
        {
            this.#errors[key].addError(error);
        }
        else if (!this.#errors[key] && error instanceof ExceptionCollection)
        {
            this.#errors[key] = error;
        }
        else
        {
            this.#errors[key] = new ExceptionCollection(error);
        }
        
        return this;
    }
    
    /**
     * @param {string} key
     * @param {number} status
     * @returns {BulkException}
     */
    setErrorCollectionStatus(key, status)
    {
        if (this.#errors[key] && this.#errors[key] instanceof ExceptionCollection)
        {
            this.#errors[key].setStatus(status);
        }
        else
        {
            this.#errors[key] = new ExceptionCollection();
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
     * @throws {BulkException}
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
     * @returns
     */
    getCollectionInstance(key)
    {
        return this.#errors[key];
    }
}

module.exports = BulkException;