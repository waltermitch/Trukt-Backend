const ErrorHandler = require('../ErrorHandler');

class HttpRouteController
{
    static async http(req, res, next)
    {
        try
        {
            // add auth step in here eventually
            // req.session = do auth stuff

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

module.exports = HttpRouteController;
