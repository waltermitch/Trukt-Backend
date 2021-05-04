const ErrorHandler = require('../Classes/ErrorHandler');
const DB = require('../Classes/DB');

// const HTTPController = require('../Classes/HTTPController');
// const DateTime = require('luxon').DateTime;

module.exports = async function (context, req)
{
    let response = { status: 400, data: 'Missing Payload' };

    context.log(req);

    if (req?.body)
    
        try
        {
            response = await test(context, req);
        }
        catch
        {
            response = new ErrorHandler(context, req);
        }

    context.res =
    {
        headers: { 'Content-Type': 'application/json' },
        status: response.status,
        body: response
    };
};

async function test(context, req)
{
    const value = req?.body?.name;

    const res = await DB.getSecret({ 'name': value });

    return { 'status': 200, 'data': res };
}

// function setExpTime()
// {
//     return DateTime.utc().plus({ hours: 24 }).toString().substr(0, 19);
// }