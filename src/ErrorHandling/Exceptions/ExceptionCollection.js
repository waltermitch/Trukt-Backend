const formatErrorMessageStructure = require('../FormatErrorMessageStructure');

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
     * @param {unknown[] | unknown} errors - The errors when class is initialized.
     */
    constructor(errors = [])
    {
        this.name = this.constructor.name;
        this.#errors = Array.isArray(errors)
            ? errors.map((error) => formatErrorMessageStructure(error, true))
            : [formatErrorMessageStructure(errors, true)];
    }

    /**
     * @param {unknown} error - The error to add to the collection.
     * @returns {ExceptionCollection}
     */
    addError(error)
    {
        this.#errors.push(formatErrorMessageStructure(error, true));

        return this;
    }

    /**
     * @param {number} status - The http status code of the exception collection.
     * @returns {ExceptionCollection}
     */
    setStatus(status)
    {
        this.#status = status;
        
        return this;
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
    throwErrorsIfExist()
    {
        if (this.doErrorsExist())
            throw this;
    }
    
    /**
     * Validates if the exception collection has errors.
     * @returns {boolean}
     */
    doErrorsExist()
    {
        return this.#errors.length > 0;
    }
}

module.exports = ExceptionCollection;