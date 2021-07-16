/**
 * Custom domain express middleware module
 */
const domain = require('domain');

const uuid = require('uuid');

module.exports = function (req, res, next)
{
    const reqd = domain.create();
    reqd.id = uuid.v4();
    reqd.req = req;
    reqd.res = res;
    reqd.run(next);
    reqd.on('error', next);
};
