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
        const dbUsers = new Map(usersFromDB.map((user) => [user.guid, user]));

        // for each user upser it to the database
        for (const user of usersFromAD)
        {
            const payload = { name: user.displayName, email: user.mail, guid: user.id };

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

module.exports = UserService;