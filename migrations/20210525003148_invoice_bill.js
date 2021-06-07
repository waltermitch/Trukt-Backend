const migration_tools = require('../tools/migration');

const table_name = 'invoice_bills';
exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').primary().notNullable().unique();
        table.integer('external_party').unsigned();
        table.foreign('external_party').references('id').inTable('salesforce.account');
        table.uuid('order');
        table.uuid('job');

        migration_tools.timestamps(knex, table);
        table.datetime('date_filed');
        table.datetime('date_due');

        table.decimal('total', 15, 2).comment('This is calculated, please do not modify manually');

        table.string('payment_method');
        table.string('payment_terms');

        table.binary('is_paid').notNullable().defaultTo(false);
        table.binary('is_invoice').notNullable().comment('true value is invoice, false value is bill');

    }).raw(migration_tools.guid_function(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
