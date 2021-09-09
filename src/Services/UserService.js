const Graph = require('../Azure/Graph');
const User = require('../Models/User');

class UserService
{
    static async getById(userGuid)
    {
        const user = await User.query().findById(userGuid);

        return user;
    }

    static async search(query)
    {
        const users = await User.query().where('name', 'ilike', `%${query}%`).orderBy('name', 'asc');

        return users.results || users;
    }

    static async syncUsersWithAD()
    {
        // gets users from AD Employee Group
        const usersFromAD = await Graph.getGroupMembers(process.env['azure.ad.groupId']);

        // gets users from DB
        const usersFromDB = await User.query();

        // map db users to map
        const dbUsers = new Map(usersFromDB.map((user, i) => [user.guid, i]));

        // for each user upser it to the database
        for (const user of usersFromAD)
        {
            // remove the user from the map
            dbUsers.delete(user.id);

            const payload = { name: user.displayName, email: user.mail, guid: user.id };

            await User.query().insert(payload).onConflict('guid').merge();
        }

        console.log(dbUsers.size);

        // for all the leftover users - mark as deleted
        for (const user of dbUsers.values())
        {
            await User.query().patchAndFetchById(user.guid, { is_deleted: true });
        }
    }
}

module.exports = UserService;