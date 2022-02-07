class HttpError extends Error
{
    /**
     * @description This class is a custom exception class meant to be used for throwing errors when http eceptions happen
     * @param {Integer} status The status code result from the exception
     * @param {String} message The error message sent to the user
     */
    constructor(status, message)
    {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }

    toJson()
    {
        const json = { errorType: this.name, message: this.message };
        Object.assign(json, this);
        delete json.status;

        return json;
    }
}

module.exports = HttpError;
