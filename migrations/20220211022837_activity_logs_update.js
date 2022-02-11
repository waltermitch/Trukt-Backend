exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE IF EXISTS rcg_tms.status_logs RENAME TO activity_logs;
        ALTER TABLE IF EXISTS rcg_tms.activity_logs RENAME COLUMN status_id TO activity_id;
        ALTER TABLE IF EXISTS rcg_tms.status_log_types RENAME TO activity_logs_types;

        ALTER TABLE rcg_tms.activity_logs RENAME CONSTRAINT status_logs_pkey TO activity_logs_pkey;
        ALTER TABLE rcg_tms.activity_logs RENAME CONSTRAINT status_logs_job_guid_foreign TO activity_logs_job_guid_foreign;
        ALTER TABLE rcg_tms.activity_logs RENAME CONSTRAINT status_logs_order_guid_foreign TO activity_logs_order_guid_foreign;
        ALTER TABLE rcg_tms.activity_logs RENAME CONSTRAINT status_logs_status_id_foreign TO activity_logs_activity_id_foreign;
        ALTER TABLE rcg_tms.activity_logs RENAME CONSTRAINT status_logs_user_guid_foreign TO activity_logs_user_guid_foreign;
        ALTER TABLE rcg_tms.activity_logs_types RENAME CONSTRAINT status_log_types_category_name_unique TO activity_log_types_category_name_unique;
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE IF EXISTS rcg_tms.activity_logs RENAME TO status_logs;
        ALTER TABLE IF EXISTS rcg_tms.status_logs RENAME COLUMN activity_id TO status_id;
        ALTER TABLE IF EXISTS rcg_tms.activity_logs_types RENAME TO status_log_types;

        ALTER TABLE rcg_tms.status_log_types RENAME CONSTRAINT activity_log_types_category_name_unique TO status_log_types_category_name_unique;
        ALTER TABLE rcg_tms.status_logs RENAME CONSTRAINT activity_logs_pkey TO status_logs_pkey;
        ALTER TABLE rcg_tms.status_logs RENAME CONSTRAINT activity_logs_job_guid_foreign TO status_logs_job_guid_foreign;
        ALTER TABLE rcg_tms.status_logs RENAME CONSTRAINT activity_logs_order_guid_foreign TO status_logs_order_guid_foreign;
        ALTER TABLE rcg_tms.status_logs RENAME CONSTRAINT activity_logs_activity_id_foreign TO status_logs_status_id_foreign;
        ALTER TABLE rcg_tms.status_logs RENAME CONSTRAINT activity_logs_user_guid_foreign TO status_logs_user_guid_foreign;
    `);
};