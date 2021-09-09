const Microsoft = require('../Azure/Microsoft');
const { DateTime } = require('luxon');
const Mongo = require('../Mongo');

const clientId = process.env['azure.ad.appId'];
const clientSecret = process.env['azure.ad.appSecret'];
const username = process.env['azure.ad.TMSusername'];
const password = process.env['azure.ad.TMSpassword'];

class SystemManagementService
{
    // function to generate tms user token
    static async generateTmsUserToken()
    {
        // get the token
        const res = await Microsoft.getTokenROPC(clientId, clientSecret, username, password);

        // save token to mongo
        await Mongo.updateSecret('tmsUserToken', { 'value': res.id_token, 'exp': DateTime.utc().plus({ minutes: 55 }).toString() });
    }
}

module.exports = SystemManagementService;