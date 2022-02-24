const Microsoft = require('../Azure/Microsoft');
const Graph = require('../Azure/Graph');
const User = require('../Models/User');
const { DateTime } = require('luxon');
const Mongo = require('../Mongo');

const clientSecret = process.env.AZURE_AD_APPSECRET;
const username = process.env.AZURE_AD_TMSUSERNAME;
const password = process.env.AZURE_AD_TMSPASSWORD;
const clientId = process.env.AZURE_AD_APPID;
const groupId = process.env.AZURE_AD_GROUPID;

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
    static async syncUsers(keepAlive = true)
    {
        // gets users from AD Employee Group and from DB
        const [usersFromAD, usersFromDB] = await Promise.all([Graph.getGroupMembers(groupId, keepAlive), User.query()]);

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