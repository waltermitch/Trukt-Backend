const controller = require('../HttpControllers/BulkController');
const router = require('express').Router();

const prefix = '/bulk';

router
    .put(`${prefix}/order/users`, (req, res) => http(req, res, controller.updateOrderUsers))
    .put(`${prefix}/job/users`, (req, res) => http(req, res, controller.updateJobUsers))
    .put(`${prefix}/job/dates`, (req, res) => http(req, res, controller.updateJobDates))
    .put(`${prefix}/job/status`, (req, res) => http(req, res, controller.updateJobStatus))
    .put(`${prefix}/job/prices`, (req, res) => http(req, res, controller.updateJobPrices))
    .put(`${prefix}/job/status/ready`, controller.setJobsReadyBulk)
    .put(`${prefix}/order/bill/export`, controller.exportBills)
    .put(`${prefix}/order/invoice/export`, controller.exportInvocies);

module.exports = router;