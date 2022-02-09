const ApplicationError = require('./ApplicationError');

class AuthenticationError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 401);
        this.name = 'AuthenticationError';
    }
}

module.exports = AuthenticationError;