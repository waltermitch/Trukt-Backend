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
     *
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'ApplicationError';
        this.message = message;
        this.status = 500;
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