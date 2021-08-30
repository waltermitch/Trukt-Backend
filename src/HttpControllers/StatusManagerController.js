const StatusManagerService = require('../Services/StatusManagerService');

class StatusManagerController
{
    static async getStatusLog(req, res, next)
    {
        const { query, params } = req;
        const validInput = StatusManagerController.validateGetStatusLogInput({ ...query, ...params });
        try
        {
            if (!validInput)
            {
                next({
                    status: 400,
                    data: { message: 'Invalid user input' }
                });
            }
            else
            {
                const statusLogs = await StatusManagerService.getStatusLogs(validInput);
                res.status(200);
                res.json(statusLogs);
            }
        }
        catch (err)
        {
            next(err);
        }
    }

    static validateGetStatusLogInput({
        pg,
        rc,
        orderGuid
    })
    {
        const query = {
            page: pg && parseInt(pg),
            rowCount: rc && parseInt(rc)
        };

        const isQueryCorrect = Object.values(query).some((param) => isNaN(param === undefined ? null : param));
        return isQueryCorrect && orderGuid ? false : { ...query, orderGuid };
    }

}

const controller = new StatusManagerController();
module.exports = controller;