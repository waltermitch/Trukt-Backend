const ApplicationError = require('./ApplicationError');

class ApiError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 500);
        this.name = 'ApiError';
    }
}

module.exports = ApiError;