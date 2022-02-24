/**
 * Homegrown authorization middleware for express.
 * 🍃🌱
 */
const Auth = require('../Services/Auth');

module.exports = {
    middleware: (config) =>
    {
        return async (req, res, next) =>
        {
            try
            {
                if (!(config?.ignorePaths?.(req.path)))
                {
                    req.session = { userGuid: (await Auth.verifyJWT(req.headers?.authorization)).oid };

                    if ('x-test-user' in req.headers && !(req.session.userGuid))
                    {
                        req.session.userGuid = req.headers['x-test-user'];
                    }
                }
                next();
            }
            catch (e)
            {
                // let error handler hand the error. :)
                next(e);
            }

        };
    },
    middlewareEDI: (config) =>
    {
        return async (req, res, next) =>
        {
            if ('x-edi-code' in req.headers && req.headers['x-edi-code'] === process.env.EDI_SECRET_CODE)
            {
                req.session = { userGuid: process.env.SYSTEM_USER };
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