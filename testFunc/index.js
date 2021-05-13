const ErrorHandler = require('../Classes/ErrorHandler');
const DB = require('../Classes/Mongo');

module.exports = async function (context, req)
{
    let response = { status: 400, data: 'Missing Payload' };

    context.log(req?.headers);

    try
    {
        response = await test(context, req);
    }
    catch
    {
        response = new ErrorHandler(context, req);
    }

    context.res = {
        headers: { 'Content-Type': 'application/json' },
        status: response.status,
        body: response
    };
};

async function test()
{
    const res = await DB.getSecret({ name: 'super_access_token_staging' });

    return { status: 200, data: res };
}

// function setExpTime()
// {
//     return DateTime.utc().plus({ hours: 24 }).toString().substr(0, 19);
// }
