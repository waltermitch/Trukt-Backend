const formatErrorMessageStructure = require('../FormatErrorMessageStructure');

class AppResponse
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
    #status = undefined;

    /**
     * @private
     * @type {unknown} - Any data to be returned with the app response.
     */
    #data = undefined;

    /**
     * @param {unknown[] | unknown} errors - The errors when class is initialized.
     */
    constructor(errors = [])
    {
        this.name = this.constructor.name;
        this.#errors = Array.isArray(errors) ? errors : [errors];
    }

    /**
     * @param {unknown} error - The error to add to the collection.
     * @returns {AppResponse}
     */
    addError(error)
    {
        this.#errors.push(error);

        return this;
    }

    /**
     * @param {unknown} data - Any data to be returned with the app response.
     * @returns {unknown}
     */
    setData(data)
    {
        this.#data = data;
        
        return this;
    }

    /**
     * @param {number} status - The http status code of the exception collection.
     * @returns {AppResponse}
     */
    setStatus(status)
    {
        this.#status = status;
        
        return this;
    }

    /**
     * @returns {{status: number, errors: {errorType: string, message: string, code?: number | string}[], data?: Record<string, unknown>}}
     */
    toJSON()
    {
        const errorCodes = [];
        const errors = [];

        if (this.doErrorsExist())
            for (let index = 0; index < this.#errors.length; index++)
            {
                const formattedError = formatErrorMessageStructure(this.#errors[index]);
                errorCodes.push(formattedError.status);
                errors.push(...formattedError.errors);
            }

        return {
            status: this.#status ?? this.#getHighestErrorCode(errors),
            errors,
            data: this.#data
        };
    }

    /**
     * @param {number[]} errorCodes
     */
    #getHighestErrorCode(errorCodes)
    {
        const highestErrorCode = Math.max(errorCodes);

        if (isNaN(highestErrorCode))
            return 500;

        return highestErrorCode === 0 ? 200 : highestErrorCode;
    }

    /**
     * @param {AppResponse} appResponse
     */
    combineResponse(appResponse)
    {
        const dataToCombine = appResponse.getResponseToCombine();
        const uniqueErrors = [...new Set([...this.#errors, ...dataToCombine.errors])];
 
        this.#errors = uniqueErrors;

        if (!dataToCombine.data)
            this.#data = dataToCombine.data;

        return this;
    }

    /**
     * DO NOT USE THIS METHOD.
     * it's only to be used by the combineResponse method.
     * @returns {{errors: unknown[], data: unknown}}
     */
    getResponseToCombine()
    {
        return {
            errors: this.#errors,
            data: this.#data
        };
    }

    /**
     * Throw the exception collection.
     * @throws {AppResponse}
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

module.exports = AppResponse;