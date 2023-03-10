const Auth = require('../Services/Auth');

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
            next(err);
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
            next(err);
        }
    }
}

global.http = HttpRouteController.http;
global.httpNoAuth = HttpRouteController.httpNoAuth;

module.exports = HttpRouteController;
