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
     * @param {string} key - Guid to identify the error collection
     * @param {ExceptionCollection | unknown} error - Error to be added to the collection
     */
    constructor(key, error)
    {
        this.#errors = {};
        this.addError(key, error);
    }

    /**
     * @param {string} key - Guid to identify the error collection
     * @param {ExceptionCollection | unknown} error - Error to be added to the collection
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
    }
    
    /**
     * @param {string} key
     * @param {number} status
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
    }

    toJSON()
    {
        const errors = Object.keys(this.#errors).reduce((errorsAcc, key) =>
        {
            return { ...errorsAcc, [key]: this.#errors[key].toJSON() };
        }, {});

        return errors;
    }
}

module.exports = BulkException;