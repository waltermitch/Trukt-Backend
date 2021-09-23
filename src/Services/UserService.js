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

}

module.exports = UserService;