const migration_tools = require('../tools/migration');
const TABLE_NAME = 'order_cases';
exports.up = function(knex) {
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        const orderId = 'order_guid';
        table.uuid(orderId).notNullable();
        table.foreign(orderId).references('guid').inTable('rcg_tms.orders');
        const caseId = 'case_guid';
        table.uuid(caseId);
        table.foreign(caseId).references('guid').inTable('rcg_tms.cases').onDelete('CASCADE');
        table.primary([orderId, caseId]);
        table.unique([orderId, caseId]);
    })
    .raw(migration_tools.guid_function(TABLE_NAME));
};

exports.down = function(knex) {
    return knex.schema.withSchema('rcg_tms')
    .dropTableIfExists(TABLE_NAME);
};
