const StatusManagerService = require('../Services/StatusManagerService');

class StatusManagerController
{
    static async getStatusLog(req, res, next)
    {
        try
        {
            const statusLogs = await StatusManagerService.getStatusLogs({ ...req.query, ...req.params });
            res.status(200);
            res.json(statusLogs);
        }
        catch (err)
        {
            next(err);
        }
    }
}

module.exports = StatusManagerController;