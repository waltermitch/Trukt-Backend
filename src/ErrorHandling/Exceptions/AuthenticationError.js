const ApplicationError = require('./ApplicationError');

class AuthenticationError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'AuthenticationError';
        this.message = message;
        this.status = 401;
    }
}

module.exports = AuthenticationError;