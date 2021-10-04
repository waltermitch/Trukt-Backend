const QBO = require('../../../src/QuickBooks/API');

exports.seed = function (knex)
{
    return QBO.syncListsToDB();
};
