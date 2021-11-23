const mappings = 'payment_term_mappings';
const termsTable = 'payment_terms';
const schemaName = 'quickbooks';

exports.up = function (knex)
{

    return knex.schema.withSchema(schemaName)
        .createTable(termsTable, (table) =>
        {
            table.integer('id', { primaryKey: true }).unique().notNullable();
            table.string('name').notNullable();
        })
        .createTable(mappings, (table) =>
        {
            table.integer('qb_term_id').notNullable();
            table.integer('term_id').unique().notNullable();

            table.foreign('qb_term_id').references('id').inTable(`${schemaName}.${termsTable}`);
            table.foreign('term_id').references('id').inTable('rcg_tms.invoice_bill_payment_terms');

            table.primary(['term_id', 'qb_term_id']);
        });
};

exports.down = function (knex)
{
    // drop schema with tables
    return knex.schema.withSchema(schemaName)
        .dropTableIfExists(termsTable)
        .dropTableIfExists(mappings);
};
