const HttpRouteController = require('./HttpRouteController');
const LoadboardService = require('../Services/LoadboardService');

// this is imported here because the file needs to be imported somewhere
// in order for it to be able to listen to incoming events from service bus
const LoadboardHandler = require('../Loadboards/LoadboardHandler');

class LoadboardController extends HttpRouteController
{
    static async createJobPost(req, res, next)
    {
        const posts = req.body.posts;

        try
        {
            LoadboardService.checkLoadboardsInput(posts);
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
            LoadboardService.checkLoadboardsInput(posts);
            await LoadboardService.postPostings(req.params.jobId, posts, req.session.userGuid);

            res.status(204).send();
        }
        catch (e)
        {
            next({
                status: 400,
                data: { message: e.toString() || 'Internal server error' }
            });
        }

    }

    static async unpostJob(req, res, next)
    {
        const posts = req.body.posts;

        try
        {
            LoadboardService.checkLoadboardsInput(posts);
            await LoadboardService.unpostPostings(req.params.jobId, posts, req.session.userGuid);

            res.status(204).send();
        }
        catch (e)
        {
            next({
                status: 400,
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
            next({
                status: 500,
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
            next({
                status: 400,
                data: { message: err.toString() }
            });
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
            next({
                status: 400,
                data: { message: err.toString() }
            });
        }
    }
}

const controller = new LoadboardController();

module.exports = controller;