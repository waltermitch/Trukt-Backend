const HttpRouteController = require('./HttpRouteController');
const LoadboardService = require('../Services/LoadboardService');

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
                status: 500,
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
                status: 500,
                data: { message: e.toString() || 'Internal server error' }
            });
        }
    }
}

const controller = new LoadboardController();

module.exports = controller;