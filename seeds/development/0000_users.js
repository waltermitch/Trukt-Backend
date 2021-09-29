const SystemManagementService = require('../../src/Services/SystemManagementService');

exports.seed = function (knex)
{
    return SystemManagementService.syncUsers();
};
