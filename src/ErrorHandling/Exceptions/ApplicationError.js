class ApplicationError extends Error
{
    /**
     * @type {string} - The name of the exception.
     */
    name;

    /**
     * @type {string} - The message of the exception.
     */
    message;

    /**
     * @type {number} - The http status code of the exception.
     */
    status;

    /**
     * @type {Record<string, unknown>} - Helpful data of the exception.
     */
    helperInfo;

    /**
     * @param {string} message - The message of the exception.
     * @param {number} status - The http status code of the exception.
     * @param {Record<string, unknown>} helperInfo - Helpful data of the exception.
     */
    constructor(message = '', status = 500, helperInfo = {})
    {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        this.status = status;
        this.helperInfo = helperInfo;
    }

    toJSON()
    {
        return {
            errorType: this.name,
            message: this.message,
            status: this.status,
            ...this.helperInfo
        };
    }
}

module.exports = ApplicationError;