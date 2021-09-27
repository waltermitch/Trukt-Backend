const Microsoft = require('../Azure/Microsoft');
const Graph = require('../Azure/Graph');
const User = require('../Models/User');
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

    // function sync users with azure
    static async syncUsers()
    {
        // gets users from AD Employee Group
        const usersFromAD = await Graph.getGroupMembers(process.env['azure.ad.groupId']);

        // gets users from DB
        const usersFromDB = await User.query();

        // map db users to map
        const dbUsers = new Map(usersFromDB.map((user) => [user.guid, user]));

        // for each user upsert it to the database
        for (const user of usersFromAD)
        {
            const payload = { name: user.displayName, email: user.mail, guid: user.id };

            // remove user from map
            dbUsers.delete(user.id);

            await User.query().insert(payload).onConflict('guid').merge();
        }

        // for all the leftover users - mark as deleted
        while (dbUsers.size > 0)
        {
            const value = dbUsers.values().next().value;
            dbUsers.delete(value.guid);
            await User.query().patchAndFetchById(value.guid, { is_deleted: true });
        }
    }

}

module.exports = SystemManagementService;