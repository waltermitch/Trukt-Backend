const SCHEMA_NAME = 'rcg_tms';
const ORDERS_TABLE = 'orders';
const JOBS_TABLE = 'order_jobs';
const verifiedField = 'verified_by_guid';
const verifiedDate = 'date_verified';

exports.up = function(knex)
{
  return knex.schema.withSchema(SCHEMA_NAME).table(ORDERS_TABLE, table =>
    {
        table.uuid(verifiedField).comment('The user that verified the order and moved it to a ready status');
        table.foreign(verifiedField).references('guid').inTable('tms_users');

        table.datetime(verifiedDate).comment('Datetime when the order was verified');
    }).table(JOBS_TABLE, table =>
    {
        table.uuid(verifiedField).comment('The user that verified the job and moved it to a ready status');
        table.foreign(verifiedField).references('guid').inTable('tms_users');

        table.datetime(verifiedDate).comment('Datetime when the job was verified');
    });
};

exports.down = function(knex)
{
  return knex.schema.withSchema(SCHEMA_NAME).table(ORDERS_TABLE, table =>
    {
        table.dropForeign(verifiedField);
        table.dropColumn(verifiedField);
        table.dropColumn(verifiedDate);
    }).table(JOBS_TABLE, table =>
    {
        table.dropForeign(verifiedField);
        table.dropColumn(verifiedField);
        table.dropColumn(verifiedDate);
    });
};
