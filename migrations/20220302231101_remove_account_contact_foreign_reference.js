/**
 * The purpose of this migration file is to remove all foreign key constraints of tables
 * that look up to salesforce accounts and contacts. The reason is because
 * there are times when the heroku connection with salesforce will need to be reloaded. A heroku reload
 * is a destructive change that drops all the records in the salesforce schema and tries to reseed the
 * data from salesforce. More can be read here: https://devcenter.heroku.com/articles/managing-heroku-connect-mappings#reload-a-mapping
 * Since a reload drops data, this creates problems as there are records that are reliant on the
 * current data(account/contact guids) through foreign key constraints. Attempting to do a reload
 * with these active foreign key constraints freezes the reload as the database does not allow records
 * used as foreign keys to be deleted. The reload job gets stuck in the reload status and will not be changed
 * until data conflicts are resolved. Thus in order to have an easier time reloading the database from heroku,
 * we need to remove the foreign key contstraints related to accounts and contacts.
 *
 * TLDR: There are times when we need to reload the database from heroku, but since there are other records
 * that have foreign key constraints, we cannot delete the old records. Removing the constraints will allow us
 * to perform database reloads without freezing heroku.
 *
 */
exports.up = function(knex)
{
  return knex.schema.withSchema('rcg_tms').table('orders', table =>
    {
        table.dropForeign('client_guid');
        table.dropForeign('client_contact_guid');
        table.dropForeign('salesperson_guid');
        table.dropForeign('referrer_guid');
    }).table('order_jobs', table =>
    {
        table.dropForeign('vendor_guid');
        table.dropForeign('vendor_contact_guid');
        table.dropForeign('vendor_agent_guid');
    }).table('order_job_dispatches', table =>
    {
        table.dropForeign('vendor_guid');
        table.dropForeign('vendor_contact_guid');
        table.dropForeign('vendor_agent_guid');
    }).table('invoice_bills', table =>
    {
        table.dropForeign('consignee_guid');
    });
};

exports.down = function(knex)
{
  return knex.schema.withSchema('rcg_tms').table('orders', table =>
    {
        table.foreign('client_guid').references('guid__c').inTable('salesforce.account');
        table.foreign('client_contact_guid').references('guid__c').inTable('salesforce.contact');
        table.foreign('salesperson_guid').references('guid__c').inTable('salesforce.account');
        table.foreign('referrer_guid').references('guid__c').inTable('salesforce.account');
    }).table('order_jobs', table =>
    {
        table.foreign('vendor_guid').references('guid__c').inTable('salesforce.account');
        table.foreign('vendor_contact_guid').references('guid__c').inTable('salesforce.contact');
        table.foreign('vendor_agent_guid').references('guid__c').inTable('salesforce.contact');
    }).table('order_job_dispatches', table =>
    {
        table.foreign('vendor_guid').references('guid__c').inTable('salesforce.account');
        table.foreign('vendor_contact_guid').references('guid__c').inTable('salesforce.contact');
        table.foreign('vendor_agent_guid').references('guid__c').inTable('salesforce.contact');
    }).table('invoice_bills', table =>
    {
        table.foreign('consignee_guid').references('guid__c').inTable('salesforce.account');
    });
};
