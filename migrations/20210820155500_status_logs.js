const migration_tools = require('../tools/migration');

const TABLE_NAME = 'status_logs';
const SCHEMA_NAME = 'rcg_tms';

exports.up = function (knex)
{

    return knex.schema.withSchema(SCHEMA_NAME).createTable(TABLE_NAME, (table) =>
    {
        const userGuid = 'user_guid';
        const orderGuid = 'order_guid';
        const jobId = 'job_guid';
        const statusId = 'status_id';

        table.increments('id', { primaryKey: true }).notNullable();

        table.uuid(userGuid);
        table.foreign(userGuid).references('guid').inTable(`${SCHEMA_NAME}.tms_users`);

        table.uuid(orderGuid);
        table.foreign(orderGuid).references('guid').inTable(`${SCHEMA_NAME}.orders`);

        table.uuid(jobId);
        table.foreign(jobId).references('guid').inTable(`${SCHEMA_NAME}.order_jobs`);

        table.integer(statusId).unsigned();
        table.foreign(statusId).references('id').inTable(`${SCHEMA_NAME}.status_log_types`);

        table.json('extra_annotations');
        migration_tools.timestamps(table);
    })
        .raw(migration_tools.timestamps_trigger(TABLE_NAME));

};

exports.down = function (knex)
{
    return knex.schema.withSchema(SCHEMA_NAME).dropTableIfExists(TABLE_NAME);

};
