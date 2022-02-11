const formatErrorMessageStructure = require("../FormatErrorMessageStructure");

class ExceptionCollection
{
    /**
     * @private
     * @type {unknown[]} - List of exceptions to return.
    */
    #errors = [];

    /**
     * @private
     * @type {number} - The http status code of the exception collection.
     */
    #status = 500;

    /**
     * @param {unknown[]} errors - The errors when class is instaciated.
     */
    constructor(errors = [])
    {
        this.name = this.constructor.name;
        this.#errors = errors.map(formatErrorMessageStructure);
    }

    /**
     * @param {unknown} error - The error to add to the collection.
     */
    addError(error)
    {
        this.#errors.push(formatErrorMessageStructure(error));
    }

    /**
     * @param {number} status - The http status code of the exception collection.
     */
    setStatus(status)
    {
        this.#status = status;
    }

    /**
     * @returns {{errorType: string, status: number, errors: ({errorType: string, message: string, code?: number | string} | unknown)[], data?: Record<string, unknown>}}
     */
    toJSON()
    {
        return {
            errorType: this.name,
            status: this.#status,
            errors: this.#errors
        };
    }

    /**
     * Throw the exception collection.
     * @throws {ExceptionCollection}
     */
    throwErrors()
    {
        throw this;
    }
}

module.exports = ExceptionCollection;