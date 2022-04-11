const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'invoice_bill_lines';

exports.up = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME, (table) =>
        {
            table.boolean('system_defined').defaultTo(false);
            table.enu('system_usage', ['none', 'base_pay', 'referrer'], { useNative: true, enumName: 'system_usage' }).defaultTo('none');
        });
};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME)
        .alterTable(TABLE_NAME, (table) =>
        {
            table.dropColumn('system_defined');
            table.dropColumn('system_usage');
        }).raw(`DROP TYPE IF EXISTS ${SCHEMA_NAME}.system_usage;`);
};
