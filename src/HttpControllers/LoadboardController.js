const HttpError = require('../ErrorHandling/Exceptions/HttpError');
const LoadboardService = require('../Services/LoadboardService');

// this is imported here because the file needs to be imported somewhere
// in order for it to be able to listen to incoming events from service bus
const LoadboardHandler = require('../Loadboards/LoadboardHandler');

class LoadboardController
{
    static async createJobPost(req, res, next)
    {
        const posts = req.body.posts;

        try
        {
            LoadboardService.checkLoadboardsInput(posts, 'create');
            await LoadboardService.createPostings(req.params.jobId, posts, req.session.userGuid);

            res.status(204).send();
        }
        catch (e)
        {
            next({
                status: 500,
                data: { message: e.toString() || 'Internal server error' }
            });
        }
    }

    static async postJob(req, res, next)
    {
        const posts = req.body.posts;

        try
        {
            LoadboardService.checkLoadboardsInput(posts, 'post');
            await LoadboardService.postPostings(req.params.jobId, posts, req.session.userGuid);

            res.status(204).send();
        }
        catch (e)
        {
            let status = 400;
            if (e.toString() == 'Error: Job not found')
            {
                status = 404;
            }
            next({
                status,
                data: { message: e.message || 'Internal server error' }
            });
        }

    }

    static async unpostJob(req, res, next)
    {
        const posts = req.body.posts;

        try
        {
            LoadboardService.checkLoadboardsInput(posts, 'unpost');
            await LoadboardService.unpostPostings(req.params.jobId, posts, req.session.userGuid);

            res.status(204).send();
        }
        catch (e)
        {
            let status = 400;
            if (e.toString() == 'Error: Job not found')
            {
                status = 404;
            }
            next({
                status,
                data: { message: e.toString() || 'Internal server error' }
            });
        }
    }

    static async getJobPostings(req, res, next)
    {
        try
        {
            const posts = await LoadboardService.getAllLoadboardPosts(req.params.jobId);

            res.json(posts);
            res.status(200);
        }
        catch (e)
        {
            let status = 400;
            if (e.toString() == 'Error: Job not found')
            {
                status = 404;
            }
            next({
                status,
                data: { message: e.toString() || 'Internal server error' }
            });
        }
    }

    static async dispatchJob(req, res, next)
    {
        try
        {
            const dispatch = await LoadboardService.dispatchJob(req.params.jobId, req.body, req.session.userGuid);
            res.json(dispatch);
            res.status(200);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async cancelDispatch(req, res, next)
    {
        try
        {
            const dispatch = await LoadboardService.cancelDispatch(req.params.jobId, req.session.userGuid);
            res.json(dispatch);
            res.status(200);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async acceptDispatch(req, res, next)
    {
        try
        {
            const response = await LoadboardService.acceptDispatch(req.params.jobId, req.session.userGuid);
            res.json(response);
            res.status(200);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async postingBooked(req, res, next)
    {
        try
        {
            const carrierGuid = req.body?.carrierSFId || req.body?.carrierExternalId;

            // do some validation
            if (!req.body.externalPostingGuid)
                throw new HttpError(400, 'Missing external posting guid');
            else if (!req.body.loadboard)
                throw new HttpError(400, 'Missing loadboard name');
            else if (!carrierGuid)
                throw new HttpError(400, 'Carrier External Id or SF Id is missing');

            await LoadboardService.postingBooked(req.body.externalPostingGuid, carrierGuid, req.body.loadboard);

            res.status(200).send();
        }
        catch (err)
        {
            next(err);
        }
    }
}

module.exports = LoadboardController;