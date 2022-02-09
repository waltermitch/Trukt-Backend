const ApplicationError = require('./ApplicationError');

class NotAllowedError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'NotAllowedError';
        this.message = message;
        this.status = 403;
    }
}

module.exports = NotAllowedError;