/**
 * Syncs users from AD to the postgres database into the rcg_tms.tms_users table.
 */
const Mongo = require('../../src/Mongo');
const SystemManagementService = require('../../src/Services/SystemManagementService');

exports.seed = async function (knex)
{
    await Mongo.connect();
    await SystemManagementService.syncUsers(false);
    await Mongo.disconnect();
};
