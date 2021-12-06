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
            console.log(error);
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
            if(!response)
            {
                throw new Error('Job not Found');
            }
            myEmitter.emit('orderjob_hold_added', { guid: jobGuid });
            res.status(202).json(response);
        }
        catch(error)
        {
            next({
                status: 404,
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
            if(!response)
            {
                throw new Error('Job not Found');
            }
            myEmitter.emit('orderjob_hold_removed', { guid: jobGuid });
            res.status(202).json(response);
        }
        catch(error)
        {
            next({
                status: 404,
                data: { message: error?.message || 'Internal server error' }
            });
        }
    }
}

module.exports = OrderJobController;