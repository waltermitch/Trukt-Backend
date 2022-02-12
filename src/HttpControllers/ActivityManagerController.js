const activityManagerService = require('../Services/ActivityManagerService');

class ActivityManagerController
{
    static async getActivities(req, res)
    {
        const activityLogs = await activityManagerService.getJobActivities({ ...req.query, ...req.params });
        res.status(200);
        res.json(activityLogs);
    }
}

module.exports = ActivityManagerController;