const UserService = require('../Services/UserService');

class UserController
{
    static async search(req, res, next)
    {
        try
        {
            const result = await UserService.search(req.query);
            res.status(200).json(result);
        }
        catch (err)
        {
            next(err);
        }
    }
}

module.exports = UserController;