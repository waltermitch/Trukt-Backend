const schemaName = 'quickbooks';
const accountsTable = 'accounts';
const mappings = 'account_mappings';

exports.up = function (knex)
{

    return knex.schema.withSchema(schemaName)
        .createTable(accountsTable, (table) =>
        {
            table.uuid('guid').notNullable().unique();
            table.integer('id', { primaryKey: true }).unique().notNullable();
            table.string('name').notNullable();
        })
        .createTable(mappings, (table) =>
        {
            table.uuid('account_guid').unique().notNullable();
            table.integer('item_id').notNullable();
        });
};

exports.down = function (knex)
{
    // drop schema with tables
    return knex.schema.withSchema(schemaName)
        .dropTableIfExists(accountsTable)
        .dropTableIfExists(mappings);
};
