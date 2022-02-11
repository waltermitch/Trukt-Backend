const ApplicationError = require('./ApplicationError');

class NotAllowedError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 403);
        this.name = this.constructor.name;
    }
}

module.exports = NotAllowedError;