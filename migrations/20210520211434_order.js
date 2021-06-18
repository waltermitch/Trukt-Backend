const migration_tools = require('../tools/migration');

const table_name = 'orders';

exports.up = function (knex)
{
    return Promise.all([
        knex.schema.withSchema('rcg_tms').createTable(table_name, table =>
        {
            table.comment('The information about the customer order');
            table.uuid('guid').primary().notNullable().unique();
            table.string('number', 8).unique().comment('the order number will be generated from a trigger stored in the index numbers table ');
            const clientfieldname = 'client_guid';
            table.string(clientfieldname, 100).notNullable();
            table.foreign(clientfieldname).references('guid__c').inTable('salesforce.account');
            const contactfieldname = 'contact_guid';
            table.string(contactfieldname, 100).unsigned();
            table.foreign(contactfieldname).references('guid__c').inTable('salesforce.contact');
            table.text('instructions');
            table.uuid('owner').comment('This is the person in charge of making sure the order is full-filled. Either dispatcher or other actor.');
            table.uuid('referrer').comment('This is the person who referred this order');

            // status fields and statistics
            table.string('status').comment('This is purely for display for the user, do not change this status manually');
            table.decimal('distance', 8, 1).unsigned().comment('The maximum truck-route distance between all the order stops sorted by the sequence in miles');

            // boolean status fields
            table.boolean('is_dummy').defaultTo(false);
            table.boolean('is_deleted').defaultTo(false);
            table.boolean('is_completed').defaultTo(false);

            // currency values / fields
            table.decimal('estimated_expense', 15, 2).unsigned().comment('This is the estimated amount of money it will cost to hire a vendor/carrier to complete the order');
            table.decimal('estimated_revenue', 15, 2).unsigned().comment('This is the estimated amount of money a client would be paying for the order');
            table.decimal('quoted_revenue', 15, 2).unsigned().comment('This is the amount of money that was quoted for the client');
            table.decimal('estimated_income', 15, 2).unsigned().comment('This is the difference between the estimated revenue and expense');
            table.decimal('actual_revenue', 15, 2).unsigned().comment('This is the actual amount of money that the order brings into the company');
            table.decimal('actual_expense', 15, 2).unsigned().comment('This is the actual amoutn of money that was spent on this order');
            table.decimal('actual_income', 15, 2).comment('This the the actual income / profit made on the order');

            // date time fields
            table.datetime('date_expected_complete_by').comment('The date this order is expected to be completed by');
            table.datetime('date_completed').comment('The date that the order was completed and all commodities delivered');
            migration_tools.timestamps(knex, table);

        }).raw(migration_tools.guid_function(table_name)).raw(`
        
            CREATE TRIGGER rcg_order_number_assignment
                BEFORE INSERT OR UPDATE
                ON rcg_tms.${table_name}
                FOR EACH ROW
                EXECUTE FUNCTION rcg_tms.rcg_order_number_assign();
            
            COMMENT ON TRIGGER rcg_order_number_assignment ON rcg_tms.${table_name}
                IS 'Assigns the order number and prevents users from changing it willy nilly';
        `).raw(migration_tools.timestamps_trigger(table_name))
    ]);
};

exports.down = function (knex)
{
    return knex.schema.withSchema('rcg_tms').dropTableIfExists(`${table_name}`);
};
