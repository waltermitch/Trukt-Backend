module.exports = class HttpError extends Error
{
    /**
    * @description This class is a custom exception class meant to be used for throwing errors when http eceptions happen
    * @param {*} message The error message sent to the user
    * @param {*} status The status code result from the exception
    * @param {*} params The http request query paramaters
    * @param {*} userId The id of the user that caused the exception
    * @param {*} body The original request body
    * @param {*} exception The original exception that was thrown
    * @param {*} method The http method used to cause the exception
    * @param {*} url The url used to cause the exception
    */
    constructor(
            message,
            status,
            params,
            userId,
            body,
            exception,
            method,
            url
        )
    {
        super(message);
        this.message = message;
        this.name = 'HttpError';
        this.status = status;
        this.params = params;
        this.userId = userId;
        this.body = body;
        this.exception = exception;
        this.method = method;
        this.url = url;
    }
};
