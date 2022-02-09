class ApplicationError extends Error
{
    /**
     * @type {string} - The name of the exception.
     */
    name;

    /**
     * @type {string} - The message of the exception.
     */
    message = '';

    /**
     * @type {number} - The http status code of the exception.
     */
    status = 500;

    /**
     * @param {string} message - The message of the exception.
     * @param {number} status - The http status code of the exception.
     */
    constructor(message, status)
    {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        this.status = status;
    }

    toJSON()
    {
        return {
            errorType: this.name,
            message: this.message,
            status: this.status
        };
    }
}

module.exports = ApplicationError;