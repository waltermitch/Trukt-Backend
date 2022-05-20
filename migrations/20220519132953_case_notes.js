const migration_tools = require('../tools/migration');
const TABLE_NAME = 'case_notes';

exports.up = function(knex) {
    return knex.schema.withSchema('rcg_tms').createTable(TABLE_NAME, (table) =>
    {
        const caseId = 'case_guid';
        table.uuid(caseId).notNullable();
        table.foreign(caseId).references('guid').inTable('rcg_tms.cases');
        const noteId = 'note_guid';
        table.uuid(noteId);
        table.foreign(noteId).references('guid').inTable('rcg_tms.generic_notes').onDelete('CASCADE');
        table.primary([caseId, noteId]);
        table.unique([caseId, noteId]);
    })
    .raw(migration_tools.guid_function(TABLE_NAME));
};

exports.down = function(knex) {
    return knex.schema.withSchema('rcg_tms')
    .dropTableIfExists(TABLE_NAME);
};
