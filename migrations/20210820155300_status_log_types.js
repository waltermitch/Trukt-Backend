const TABLE_NAME = 'status_log_types';
const SCHEMA_NAME = 'rcg_tms';

const status_log_type_records = [
    {
        id: 1, category: 'order', name: 'Created', order_filter_label: 'Created On'
    },
    {
        id: 2, category: 'order', name: 'Posted to', order_filter_label: null
    },
    {
        id: 3, category: 'order', name: 'Un-Posted from', order_filter_label: null
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
        return knex(TABLE_NAME).insert(status_log_type_records);
    });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).dropTableIfExists(TABLE_NAME);
};
