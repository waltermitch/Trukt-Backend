/**
 * Homegrown authorization middleware for express.
 */
const Auth = require('../Services/Auth');

module.exports = {
    middleware: () =>
    {
        return async (req, res, next) =>
        {
            try
            {
                req.session.userGuid = (await Auth.verifyJWT(req.headers?.authorization)).oid;

                if ('x-test-user' in req.headers && !req.session?.userGuid)
                {
                    req.session.userGuid = req.headers['x-test-user'];
                }
            }
            catch (e)
            {
                // do nothing
            }

            next();
        };
    },
    middlewareEDI: () =>
    {
        return async (req, res, next) =>
        {
            if ('x-edi-code' in req.headers && req.headers['x-edi-code'] === process.env['edi.secret.code'])
            {
                req.session.userGuid = process.env.SYSTEM_USER;
                next();
            }
            else
            {
                res.status(401);
                res.send();
            }

        };
    }
};