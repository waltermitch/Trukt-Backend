const ApplicationError = require('./ApplicationError');

class NotFoundError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message);
        this.name = 'NotFoundError';
        this.message = message;
        this.status = 404;
    }
}

module.exports = NotFoundError;