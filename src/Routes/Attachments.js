const controller = require('../HttpControllers/AttachmentController.js');
const router = require('express').Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const prefix = '/attachments';
router
    .get(`${prefix}`, controller.constructor.search)
    .post(`${prefix}`, upload.any(), controller.constructor.store);

module.exports = router;