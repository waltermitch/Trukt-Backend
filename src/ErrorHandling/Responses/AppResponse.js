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
     * Do not default this value. Otherwise you will need to update toJSON method.
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
     * @returns {{errors: unknown[], data: unknown, status: number}}
     */
    toJSON()
    {
        const errorCodes = [];
        const errors = [];

        if (this.doErrorsExist())
        {
            for (let index = 0; index < this.#errors.length; index++)
            {
                const formattedError = formatErrorMessageStructure(this.#errors[index]);
                errorCodes.push(formattedError.status);
                errors.push(...formattedError.errors);
            }

        }
        else
        {
            this.#status = 200;
        }

        return {
            status: this.#status ?? this.#getHighestErrorCode(errorCodes),
            errors,
            data: this.#data
        };
    }

    /**
     * @param {number[]} errorCodes
     */
    #getHighestErrorCode(errorCodes)
    {
        const highestErrorCode = Math.max(...errorCodes);

        if (isNaN(highestErrorCode))
            return 500;

        return highestErrorCode === 0 ? 200 : highestErrorCode;
    }

    /**
     * @param {AppResponse} appResponse
     */
    combineResponse(appResponse)
    {
        const uniqueErrors = [...new Set([...this.#errors, ...appResponse.#errors])];

        this.#errors = uniqueErrors;

        if (!this.#data && appResponse.#data)
            this.#data = appResponse.#data;

        return this;
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