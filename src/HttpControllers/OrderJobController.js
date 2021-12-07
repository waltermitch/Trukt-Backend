const OrderStopService = require('../Services/OrderStopService');
const NotesService = require('../Services/NotesService');
const StatusCacheManager = require('../EventManager/StatusCacheManager');
const OrderJobService = require('../Services/OrderJobService');
const myEmitter = require('../Services/EventEmitter');

class OrderJobController
{
    static async getJobNotes(req, res)
    {
        const result = await NotesService.getJobNotes(req.params.jobGuid);

        if (!result)
            res.status(404).json({ 'error': 'Job Not Found' });
        else
            res.status(200).json(result);
    }

    static async updateStopStatus(req, res)
    {
        const result = await OrderStopService.updateStopStatus(req.params, req.body);

        if (result)
            res.status(200).json(result);
    }

    static async getAllStatusCount(req, res)
    {
        try
        {
            const result = await StatusCacheManager.returnUpdatedCache();
            if (result)
            {
                res.status(200);
                res.json(result);
            }
        }
        catch (error)
        {
            res.status(400);
            res.json(error);
        }

    }

    static async setJobToOnHold(req, res, next)
    {
        const jobGuid = req.params.jobGuid;
        try
        {
            const response = await OrderJobService.putOnHold(jobGuid, req.session.userGuid);
            if(response.status >= 400)
            {
                throw Error(response.error);
            }
            myEmitter.emit('orderjob_hold_added', { guid: jobGuid });
            res.status(202).json(response);
        }
        catch(error)
        {
            let status = 400;
            if(error.message == 'Job Not Found')
            {
                status = 404;
            }
            next({
                status,
                data: { message: error?.message || 'Internal server error' }
            });
        }
    }

    static async unsetJobOnHold(req, res, next)
    {
        const jobGuid = req.params.jobGuid;

        try
        {
            const response = await OrderJobService.unsetOnHold(jobGuid, req.session.userGuid);
            if(response.status >= 400)
            {
                throw Error(response.error);
            }
            myEmitter.emit('orderjob_hold_removed', { guid: jobGuid });
            res.status(202).json(response);
        }
        catch(error)
        {
            let status = 400;
            if(error.message == 'Job Not Found')
            {
                status = 404;
            }
            next({
                status,
                data: { message: error?.message || 'Internal server error' }
            });
        }
    }
}

module.exports = OrderJobController;