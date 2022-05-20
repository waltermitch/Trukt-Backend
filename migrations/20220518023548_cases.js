const migration_tools = require('../tools/migration');
const TABLE_NAME = 'cases';
const TABLE_NAME_LABEL = 'case_labels';

exports.up = function(knex) {
    return knex.schema.withSchema('rcg_tms')
    .createTable(TABLE_NAME_LABEL, (table) => {
        table.increments('id', { primaryKey: true }).notNullable().comment('just the id of the record');
        table.string('label').comment('This is the case label');
        table.string('description').comment('this is the description of why the label exists. This will be used like a tooltip or other.');
    })
    .createTable(TABLE_NAME, table =>
    {
        table.uuid('guid').primary().notNullable().unique();
        const caseLabelId = 'case_label_id';
        table.integer(caseLabelId).unsigned().notNullable().comment('the name of the case');
        table.foreign(caseLabelId).references('id').inTable('rcg_tms.case_labels');
        table.boolean('is_resolved').notNullable().defaultsTo(false).comment('this should only be checked if the Case has been resolved');
        table.datetime(`date_resolved`).comment('marks the date and time that the Case was resolved');
        const resolvedUserFieldName = 'resolved_by_guid';
        table.uuid(resolvedUserFieldName).comment('records who marked the Case as resolved.');
        table.foreign(resolvedUserFieldName).references('guid').inTable('rcg_tms.tms_users');
        migration_tools.timestamps(table);
        migration_tools.authors(table);
    })
    .raw(migration_tools.guid_function(TABLE_NAME))
    .raw(migration_tools.timestamps_trigger(TABLE_NAME))
    .raw(migration_tools.authors_trigger(TABLE_NAME))
    .raw(`CREATE TRIGGER rcg_case_stat_count_change
            AFTER INSERT OR UPDATE OR DELETE
            ON rcg_tms.${TABLE_NAME}
            FOR EACH ROW
            EXECUTE FUNCTION rcg_tms.rcg_case_stat_count();

            COMMENT ON TRIGGER rcg_case_stat_count_change ON rcg_tms.${TABLE_NAME}
                IS 'Change the count of Case Label States';
        `);

};

exports.down = function(knex) {
    return knex.schema.withSchema('rcg_tms')
    .dropTableIfExists(TABLE_NAME_LABEL)
    .dropTableIfExists(TABLE_NAME);
};
