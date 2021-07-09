const migration_tools = require('../tools/migration');

const table_name = 'order_jobs';

exports.up = function (knex)
{
    return knex.schema.withSchema('rcg_tms').createTable(table_name, (table) =>
    {
        table.uuid('guid').unique().notNullable().primary();

        const orderguid = 'order_guid';
        table.uuid(orderguid);
        table.foreign(orderguid).references('guid').inTable('rcg_tms.orders');
        table.string('number', 9).comment('The job number based off of the order number');
        const vendorguid = 'vendor_guid';
        table.string(vendorguid, 100).comment('The account completing the job for the company');
        table.foreign(vendorguid).references('guid__c').inTable('salesforce.account');

        const vendorcontguid = 'vendor_contact_guid';
        table.string(vendorcontguid, 100).comment('The vendor\'s primary contact');
        table.foreign(vendorcontguid).references('guid__c').inTable('salesforce.contact');

        migration_tools.timestamps(knex, table);
        table.uuid('owner_guid').comment('This is the person in charge of making sure the job is full-filled. Either dispatcher or other actor.');

        table.string('status').comment('This is purley for display for user, do not change this status manually');
        table.decimal('distance', 8, 1).unsigned().comment('The maximum truck-route distance between all the order stops sorted by the sequence in miles');

        table.boolean('is_dummy').defaultTo(false);
        table.boolean('is_deleted').defaultTo(false);
        table.boolean('is_completed').defaultTo(false);
        table.boolean('is_transport').notNullable();

        table.decimal('estimated_expense', 15, 2).unsigned().comment('This is the estimated amount of money it will cost to hire a vendor/carrier to complete the order');
        table.decimal('estimated_revenue', 15, 2).unsigned().comment('This is the estimated amount of money a client would be paying for the order');
        table.decimal('quoted_revenue', 15, 2).unsigned().comment('This is the amount of money that was quoted for the client');
        table.decimal('estimated_income', 15, 2).unsigned().comment('This is the difference between the estimated revenue and expense');
        table.decimal('actual_revenue', 15, 2).unsigned().comment('This is the actual amount of money that the order brings into the company');
        table.decimal('actual_expense', 15, 2).unsigned().comment('This is the actual amoutn of money that was spent on this order');
        table.decimal('actual_income', 15, 2).comment('This the the actual income / profit made on the order');

        table.datetime('date_started').comment('The date that the job was started i.e when the job was dispatched');
        table.datetime('date_completed').comment('The date that the job was completed and all commodities delivered');

    }).raw(migration_tools.guid_function(table_name)).raw(`
        CREATE TRIGGER rcg_order_job_number_assignment
            BEFORE INSERT OR UPDATE
            ON rcg_tms.${table_name}
            FOR EACH ROW
            EXECUTE FUNCTION rcg_tms.rcg_order_job_number_assign();

        COMMENT ON TRIGGER rcg_order_job_number_assignment ON rcg_tms.${table_name}
            IS 'Assigns the order job number and prevents users from changing it willy nilly';
    `).raw(migration_tools.timestamps_trigger(table_name));
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(table_name);
};
