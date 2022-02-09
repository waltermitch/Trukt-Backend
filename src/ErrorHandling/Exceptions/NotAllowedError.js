const ApplicationError = require('./ApplicationError');

class NotAllowedError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 403);
        this.name = 'NotAllowedError';
    }
}

module.exports = NotAllowedError;