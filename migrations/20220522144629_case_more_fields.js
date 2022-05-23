const TABLE_NAME = 'cases';
const SCHEMA_NAME = 'rcg_tms';
const migration_tools = require('../tools/migration');
exports.up = function(knex) {
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME, (table) =>
        {
            migration_tools.timestamps(table);
            migration_tools.authors(table);
        })
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
    return knex.schema.withSchema(SCHEMA_NAME)
        .table(TABLE_NAME, (table) =>
        {
            table.dropColumn('date_created');
            table.dropColumn('date_updated');
            table.dropColumn('date_deleted');
            table.dropColumn('is_deleted');
            table.dropColumn('created_by_guid');
            table.dropColumn('updated_by_guid');
            table.dropColumn('deleted_by_guid');
        });
};
