const ErrorHandler = require('../Classes/ErrorHandler');
const start = require('../tools/start');

module.exports = async function (context, req)
{
    let response = { status: 400, data: 'Missing Payload' };

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

async function test()
{
    start();

    return { 'status': 200 };
}