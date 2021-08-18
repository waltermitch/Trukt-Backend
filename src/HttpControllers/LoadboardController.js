const HttpRouteController = require('./HttpRouteController');
const LoadboardService = require('../Services/LoadboardService');

class LoadboardController extends HttpRouteController
{
    static async handlePost(req, res)
    {
        const posts = req.body.posts;
        
        try
        {
            LoadboardService.checkLoadboardsInput(posts);
            const pot = await LoadboardService.postPostings(req.params.jobId, posts, req.session.userGuid);

            res.status(200);
            res.json(pot);
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
            const pot = await LoadboardService.unpostPostings(req.params.jobId, posts, req.session.userGuid);

            res.status(200);
            res.json(pot);
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