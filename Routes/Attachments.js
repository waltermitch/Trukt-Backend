const controller = require('../Classes/HttpControllers/AttachmentController.js');
const router = require('express').Router();

// TODO: add multer package and middleware
const prefix = '/attachments';
router
    .get(`${prefix}`, controller.constructor.search)
    .post(`${prefix}`, controller.constructor.store);

module.exports = router;