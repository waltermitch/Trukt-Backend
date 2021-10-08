/**
 * Syncs Quickbooks Online Accounts, Payment Terms, and Payment Methods to the progress databases.
 */
const Mongo = require('../../src/Mongo');
const QBO = require('../../src/QuickBooks/API');

exports.seed = async function (knex)
{
    await Mongo.connect();
    await QBO.syncListsToDB(false);
    await Mongo.disconnect();
};
