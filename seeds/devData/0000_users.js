const SystemManagementService = require('../../src/Services/SystemManagementService');
const Mongo = require('../../src/Mongo');

exports.seed = async function (knex)
{
    await SystemManagementService.syncUsers(false);
    const mongoclient = Mongo.getMongoClient();
    const client = Mongo.getClient();
    await client.close();
    await mongoclient.close();
};
