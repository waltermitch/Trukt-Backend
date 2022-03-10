const controller = require('../HttpControllers/BulkController');
const router = require('express').Router();

const prefix = '/bulk';

router
    .put(`${prefix}/order/users`, controller.updateOrderUsers)
    .put(`${prefix}/job/users`, controller.updateJobUsers)
    .put(`${prefix}/job/dates`, controller.updateJobDates)
    .put(`${prefix}/job/status`, controller.updateJobStatus)
    .put(`${prefix}/job/prices`, controller.updateJobPrices)
    .put(`${prefix}/tender/:action(accept|reject)`, controller.handleTenderBulk)
    .put(`${prefix}/job/status/ready`, controller.setJobsReadyBulk)
    .put(`${prefix}/order/bill/export`, controller.exportBills)
    .put(`${prefix}/order/invoice/export`, controller.exportInvocies);

module.exports = router;