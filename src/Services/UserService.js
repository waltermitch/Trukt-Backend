const User = require('../Models/User');

class UserService
{
    static async getById(userGuid)
    {
        const user = await User.query().findById(userGuid);

        return user;
    }

    static async search({
        search,
        pg = 1,
        rc = 25
    })
    {
        // GUI will be using starting index of 1, database uses starting index of 0
        pg = Math.max(1, pg) - 1;

        // clamp the amount between 1 and 100
        rc = Math.min(100, Math.max(1, rc));

        // clean out any special characters
        search = search.replace(/%/g, '');

        const users = await User.query()
            .where('name', 'ilike', `${search}%`)

            // prevent users from finding the TMS  System user
            .andWhereNot('name', 'TMS System')
            .orderBy('name', 'asc')
            .page(pg, rc);

        return users.results;
    }

}

module.exports = UserService;