const controller = require('../HttpControllers/AttachmentController.js');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const prefix = '/attachments';
router
    .get(`${prefix}/search`, (req, res) => http(req, res, controller.search))
    .post(`${prefix}`, upload.any(), (req, res) => http(req, res, controller.store))
    .get(`${prefix}/:attachmentId(${uuidRegexStr})`, (req, res) => http(req, res, controller.get))
    .patch(`${prefix}/:attachmentId(${uuidRegexStr})`, (req, res) => http(req, res, controller.update))
    .delete(`${prefix}/:attachmentId(${uuidRegexStr})`, (req, res) => http(req, res, controller.delete));

module.exports = router;