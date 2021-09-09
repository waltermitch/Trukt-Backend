const ErrorHandler = require('../ErrorHandler');
const Auth = require('./Auth');

class HttpRouteController
{
    static async http(req, res, next)
    {
        try
        {
            // add auth step in here eventually
            req.session.user = await Auth.verifyJWT(req.headers?.authorization);

            await next(req, res);
        }
        catch (err)
        {
            // handle error in here
            console.log(err);
            const error = new ErrorHandler(err);

            res.status(error.status || 500);
            res.json({ 'error': error.data || 'Internal Server Error' });
        }
    }

    static async httpNoAuth(req, res, next)
    {
        try
        {
            await next(req, res);
        }
        catch (err)
        {
            // handle error in here
            console.log(err);
            const error = new ErrorHandler(err);

            res.status(error.status || 500);
            res.json({ 'error': error.data || 'Internal Server Error' });
        }
    }
}

global.http = HttpRouteController.http;
global.httpNoAuth = HttpRouteController.httpNoAuth;

module.exports = HttpRouteController;
