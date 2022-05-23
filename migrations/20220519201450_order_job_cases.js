const migration_tools = require('../tools/migration');
const TABLE_NAME = 'order_job_cases';

exports.up = function(knex) {
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        const jobId = 'job_guid';
        table.uuid(jobId).notNullable();
        table.foreign(jobId).references('guid').inTable('rcg_tms.order_jobs');
        const caseId = 'case_guid';
        table.uuid(caseId);
        table.foreign(caseId).references('guid').inTable('rcg_tms.cases').onDelete('CASCADE');
        table.primary([jobId, caseId]);
        table.unique([jobId, caseId]);
    })
    .raw(migration_tools.guid_function(TABLE_NAME));
};

exports.down = function(knex) {
    return knex.schema.withSchema('rcg_tms')
    .dropTableIfExists(TABLE_NAME);
};
