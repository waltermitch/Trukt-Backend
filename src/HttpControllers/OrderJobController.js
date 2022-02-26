const StatusCacheManager = require('../EventManager/StatusCacheManager');
const OrderStopService = require('../Services/OrderStopService');
const OrderJobService = require('../Services/OrderJobService');
const NotesService = require('../Services/NotesService');
const emitter = require('../EventListeners/index');
const { NotFoundError } = require('../ErrorHandling/Exceptions');

class OrderJobController
{
    static async getJobNotes(req, res, next)
    {
        try
        {
            const result = await NotesService.getJobNotes(req.params.jobGuid);
    
            if (!result)
                throw new NotFoundError('Job Not Found');
            else
                res.status(200).json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async updateStopStatus(req, res, next)
    {
        try
        {
            const result = await OrderStopService.updateStopStatus(req.params, req.body, req.session.userGuid);

            if (result)
                res.status(200).json(result);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async getAllStatusCount(req, res, next)
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
            next(error);
        }

    }

    static async getCarrier(req, res, next)
    {
        try
        {
            const { status, data } = await OrderJobService.getJobCarrier(req.params.jobGuid);
    
            res.status(status).json(data);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async addHold(req, res, next)
    {
        await OrderJobController._toggleHold(true, req, res, next);
    }

    static async removeHold(req, res, next)
    {
        await OrderJobController._toggleHold(false, req, res, next);
    }

    static async _toggleHold(value, req, res, next)
    {
        const jobGuid = req.params.jobGuid;
        const func = value ? OrderJobService.addHold : OrderJobService.removeHold;

        try
        {
            const response = await func(jobGuid, req.session.userGuid);
            res.status(200);
            res.json(response);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async setJobToReadySingle(req, res, next)
    {
        const jobGuid = req.params.jobGuid;
        try
        {
            const result = await OrderJobService.setJobToReady(jobGuid, req.session.userGuid);
            const status = result.status || 200;

            res.status(status).json(result);
        }
        catch (e)
        {
            next(e);
        }
    }

    static async markJobAsComplete(req, res, next)
    {
        try
        {
            await OrderJobService.markJobAsComplete(req.params.jobGuid, req.session.userGuid);
            res.status(200).send();
        }
        catch (error)
        {
            next(error);
        }
    }

    static async markJobAsUncomplete(req, res, next)
    {
        try
        {
            await OrderJobService.markJobAsUncomplete(req.params.jobGuid, req.session.userGuid);
            res.status(200).send();
        }
        catch (error)
        {
            next(error);
        }
    }

    static async deleteJob(req, res, next)
    {
        try
        {
            const { status, message } = await OrderJobService.deleteJob(req.params.jobGuid, req.session.userGuid);

            res.status(status).send(message);
        }
        catch (error)
        {
            next(error);
        }
    }
    static async undeleteJob(req, res, next)
    {
        try
        {
            const { status, message } = await OrderJobService.undeleteJob(req.params.jobGuid, req.session.userGuid);

            res.status(status).send(message);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async cancelJob(req, res, next)
    {
        try
        {
            const { status, message } = await OrderJobService.cancelJob(req.params.jobGuid, req.session.userGuid);

            res.status(status).send(message);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async uncancelJob(req, res, next)
    {
        try
        {
            const { status, message } = await OrderJobService.uncancelJob(req.params.jobGuid, req.session.userGuid);

            res.status(status).send(message);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async deliveredJob(req, res, next)
    {
        try
        {
            const { status, message } = await OrderJobService.deliverJob(req.params.jobGuid, req.session.userGuid);

            res.status(status).send(message);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async undeliverJob(req, res, next)
    {
        try
        {
            const { status, message } = await OrderJobService.undeliverJob(req.params.jobGuid, req.session.userGuid);

            res.status(status).send(message);
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = OrderJobController;