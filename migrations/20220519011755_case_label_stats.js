const migration_tools = require('../tools/migration');
const TABLE_NAME = 'case_label_stats';

exports.up = function(knex) {
    return knex.schema.withSchema('rcg_tms')
    .createTable(TABLE_NAME, table =>
    {
        table.uuid('guid').primary().notNullable().unique();
        const caseLabelId = 'case_label_id';
        table.integer(caseLabelId).unsigned().notNullable().comment('the name of the case');
        table.foreign(caseLabelId).references('id').inTable('rcg_tms.case_labels');
        table.bigInteger('count').notNullable().default(0);
    })
    .raw(migration_tools.guid_function(TABLE_NAME));
    
};

exports.down = function(knex) {
    return knex.schema.withSchema('rcg_tms')
    .dropTableIfExists(TABLE_NAME);
};
