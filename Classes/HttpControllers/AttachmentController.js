const HttpRouteController = require('./HttpRouteController');

class AttachmentController extends HttpRouteController
{
    async handleGet(context, req)
    {

    }

    async handlePost(context, req)
}

const controller = new AttachmentController();
module.exports = controller;