const controller = require('../HttpControllers/AttachmentController.js');
const router = require('express').Router();

// TODO: add multer package and middleware
const prefix = '/node/express/attachments';
router
    .get(`${prefix}`, controller.constructor.search)
    .post(`${prefix}`, controller.constructor.store);

module.exports = router;