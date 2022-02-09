const ApplicationError = require('./ApplicationError');

class ApiError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'ApiError';
        this.message = message;
        this.status = 500;
    }
}

module.exports = ApiError;