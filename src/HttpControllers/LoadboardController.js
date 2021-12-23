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
            await LoadboardService.acceptDispatch(req.params.jobId, req.body.dispatchGuid, req.session.userGuid);
            res.json({ message: 'Job dispatch accepted' });
            res.status(200);
        }
        catch (err)
        {
            let status = 500;
            const message = err.toString();

            if (message === 'Error: Job not found')
                status = 404;
            else if (message === 'Error: Dispatch not found')
                status = 404;
            else if (message.match(/Error: Job/))
                status = 400;

            next({
                status,
                data: { message }
            });
        }
    }
}

const controller = new LoadboardController();

module.exports = controller;