const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'invoice_bill_lines';
const LIST_TABLE_NAME = 'invoice_bill_lines_system_fields';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .createTable(LIST_TABLE_NAME, (table) =>
        {
            table.string('type').primary();
        }).raw(`
            INSERT INTO ${SCHEMA_NAME}.${LIST_TABLE_NAME}(type) VALUES('none');
        `)
        .alterTable(TABLE_NAME, (table) =>
        {
            table.boolean('system_defined').defaultTo(false);
            table.string('system_usage').defaultTo('none');
            table.foreign('system_usage').references('type').inTable(`${SCHEMA_NAME}.${LIST_TABLE_NAME}`);
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME, (table) =>
        {
            table.dropForeign('system_usage');
            table.dropColumn('system_defined');
            table.dropColumn('system_usage');
        })
        .dropTableIfExists(LIST_TABLE_NAME);
};
