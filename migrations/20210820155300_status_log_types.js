const TABLE_NAME = 'status_log_types';
const SCHEMA_NAME = 'rcg_tms';
const STATUS_LOGS_TABLE_NAME = 'status_logs';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).createTable(TABLE_NAME, (table) =>
    {
        table.integer('id').primary();
        table.string('category', 16).notNullable();
        table.string('name', 32).notNullable();
        table.string('order_filter_label', 32).default(null);
        table.unique(['category', 'name']);
    }).then(() =>
    {
        return knex.schema.withSchema(SCHEMA_NAME).hasTable(STATUS_LOGS_TABLE_NAME).then(exists =>
        {
            // Add foreing key if status_logs exists
            if (exists)
                return knex.schema.withSchema(SCHEMA_NAME).table(STATUS_LOGS_TABLE_NAME, table =>
                    table.foreign('status_id').references('id').inTable(`${SCHEMA_NAME}.status_log_types`)
                );
        });
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).table(STATUS_LOGS_TABLE_NAME, (table) =>
    {
        // Remove foreign key in status_logs table so this table can be droped
        table.dropForeign('status_id');
    }).then(() =>
    {
        return knex.schema.withSchema(SCHEMA_NAME).dropTableIfExists(TABLE_NAME);
    });
};
