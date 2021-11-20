const validatorErrors = require('express-openapi-validator').error;

/* eslint-disable */
module.exports = (err, request, response, next) =>
{
    let status = 404;
    let data;

    // handle openapi validator errors
    if (err?.constructor?.name in validatorErrors)
    {
        response.status(err.status);
        response.json({
            errors: err.errors
        });
        return;
    }
    if (err?.response?.data)
    {
        status = err.response.status;
        data = err.response.data;
    }
    else if (err?.reason?.response)
    {
        status = err.reason?.response?.status;
        data = err.reason?.response?.data;
    }
    else if (err?.reason)
    {
        data = err.reason;
    }
    else if (err?.status && err.data)
    {
        status = err.status;
        data = err.data;
    }
    else if (err?.errors || err?.error)
    {
        status = 500;
        data = err;
    }
    else
    {
        status = err.status || 500;
        data = err.toString();
    }
    console.log(err);
    response.status(status);
    response.send(data);
};