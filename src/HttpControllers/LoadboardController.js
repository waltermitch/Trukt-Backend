const HttpRouteController = require('./HttpRouteController');
const Job = require('../Models/OrderJob');
const Loadboard = require('../Models/Loadboard');
const LoadboardService = require('../Services/LoadboardService');

const settings = require('../../local.settings');

class LoadboardController extends HttpRouteController
{
    static async handlePost(req, res)
    {
        const posts = req.body.posts;

        try
        {
            LoadboardService.checkLoadboardsInputNew(posts);

            // const pot = await LoadboardService.createPostings(req.params.jobId, loadboardNames, {});

            // const pot = await LoadboardService.postPostings(req.params.jobId, loadboardNames, {});
            const pot = await LoadboardService.postPostings(req.params.jobId, posts);

            res.status(200);
            res.json(pot);
        }
        catch (e)
        {
            console.log('error', e);
            res.status(400);
            res.json({ message: e });
        }

    }

    static async handleUnpost(req, res)
    {
        const posts = req.body.posts;

        const loadboardNames = req.body.loadboards;

        try
        {
            LoadboardService.checkLoadboardsInputNew(posts);

            const pot = await LoadboardService.unpostPostings(req.params.jobId, posts);
            res.status(200);
            res.json(pot);
        }
        catch (e)
        {
            console.log('error', e);
            res.status(400);
            res.json({ message: e });
        }
    }

    static async handleDelete(req, res)
    {
        const loadboardNames = req.body.loadboards;
        try
        {
            const response = await LoadboardService.unpostPostings(req.params.jobId, loadboardNames, {});
            await LoadboardService.executeRequests();
        }
        catch (e)
        {
            console.log('error on delete ', e);
            res.status(400);
            res.json({ message: e });
        }
    }
}

const controller = new LoadboardController();

module.exports = controller;