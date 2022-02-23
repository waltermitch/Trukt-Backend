const ApplicationError = require('./ApplicationError');

class ApiError extends ApplicationError
{
    /**
     * @param {string} message
     * @param {Record<string, unknown>} [helperInfo] - additional information to help with debugging
     */
    constructor(message, helperInfo)
    {
        super(message, 500, helperInfo);
        this.name = this.constructor.name;
    }
}

module.exports = ApiError;