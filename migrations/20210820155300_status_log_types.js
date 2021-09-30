const TABLE_NAME = 'status_log_types';
const SCHEMA_NAME = 'rcg_tms';
const STATUS_LOGS_TABLE_NAME = 'status_logs';

const status_log_type_records = [
    {
        id: 1, category: 'order', name: 'Created', order_filter_label: 'Created On'
    },
    {
        id: 2, category: 'order', name: 'Posted to', order_filter_label: null
    },
    {
        id: 3, category: 'order', name: 'Un-Posted from', order_filter_label: null
    },
    {
        id: 4, category: 'loadRequest', name: 'Created', order_filter_label: null
    },
    {
        id: 5, category: 'loadRequest', name: 'Canceled', order_filter_label: null
    },
    {
        id: 6, category: 'loadRequest', name: 'Accpeted', order_filter_label: null
    },
    {
        id: 7, category: 'loadRequest', name: 'Declined', order_filter_label: null
    }
];

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
        return knex(TABLE_NAME).insert(status_log_type_records).then(() =>
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
