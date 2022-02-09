const ApplicationError = require('./ApplicationError');

class NotFoundError extends ApplicationError
{
    /**
     * @param {string} message
     */
    constructor(message)
    {
        super(message, 404);
        this.name = this.constructor.name;
    }
}

module.exports = NotFoundError;