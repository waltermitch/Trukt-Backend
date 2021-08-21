const HttpRouteController = require('./HttpRouteController');
const LoadboardService = require('../Services/LoadboardService');

class LoadboardController extends HttpRouteController
{
    static async handleCreate(req, res)
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
            res.status(400);
            res.json({ message: e });
        }
    }

    static async handlePost(req, res)
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
            res.status(400);
            res.json({ message: e });
        }

    }

    static async handleUnpost(req, res)
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
            res.status(400);
            res.json({ message: e });
        }
    }
}

const controller = new LoadboardController();

module.exports = controller;