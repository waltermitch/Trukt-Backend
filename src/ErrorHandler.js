class ErrorHandler
{
    constructor(err)
    {
        console.log('Caught Exception: ');
        if (err?.response?.data)
        {
            this.status = err.response.status;
            this.data = err.response.data;
        }
        else if (err?.reason?.response)
        {
            this.status = err.reason?.response?.status;
            this.data = err.reason?.response?.data;
        }
        else if (err?.reason)
        {
            this.data = err.reason;
        }
        else if (err?.status && err.data)
        {
            this.status = err.status;
            this.data = err.data;
        }
        else if (err?.errors)
        {
            this.data = err;
        }
        else
        {
            this.status = 500;
            this.data = err.toString();
        }

        console.log(err);

        return this;
    }
}
module.exports = ErrorHandler;