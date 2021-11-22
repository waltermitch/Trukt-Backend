const FUNCTION_NAME = 'rcg_order_job_dispatch_actions_timestamps';
const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'order_job_dispatches';

exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${SCHEMA_NAME}.${TABLE_NAME}
        ALTER COLUMN is_pending SET NOT null,
        ALTER COLUMN is_pending SET DEFAULT true,
        ALTER COLUMN is_accepted SET NOT null,
        ALTER COLUMN is_accepted SET DEFAULT false,
        ALTER COLUMN is_canceled SET NOT null,
        ALTER COLUMN is_canceled SET DEFAULT false,
        ADD COLUMN is_valid boolean NOT NULL DEFAULT true,
        ADD COLUMN is_declined boolean NOT NULL DEFAULT false,
        ADD COLUMN date_accepted timestamptz,
        ADD COLUMN date_canceled timestamptz,
        ADD COLUMN date_declined timestamptz,
        ADD COLUMN canceled_by_guid uuid,
        ADD CONSTRAINT "order_job_dispatches_canceled_by_guid_foreign" FOREIGN KEY (canceled_by_guid) REFERENCES rcg_tms.tms_users (guid),
        ADD CONSTRAINT "order_job_dispatches_is_declined" CHECK ((is_declined = true AND is_accepted = false AND is_canceled = false) OR is_declined = false),
        ADD CONSTRAINT "order_job_dispatches_is_accepted" CHECK ((is_declined = false AND is_accepted = true AND is_canceled = false) OR is_accepted = false),
        ADD CONSTRAINT "order_job_dispatches_is_canceled" CHECK ((is_declined = false AND is_accepted = false AND is_canceled = true) OR is_canceled = false);
        `);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.${TABLE_NAME}
        ALTER COLUMN is_pending DROP NOT null,
        ALTER COLUMN is_pending DROP DEFAULT,
        ALTER COLUMN is_accepted DROP NOT null,
        ALTER COLUMN is_accepted DROP DEFAULT,
        ALTER COLUMN is_canceled DROP NOT null,
        ALTER COLUMN is_canceled DROP DEFAULT,
        DROP COLUMN IF EXISTS is_valid,
        DROP COLUMN IF EXISTS is_declined,
        DROP COLUMN IF EXISTS date_accepted,
        DROP COLUMN IF EXISTS date_canceled,
        DROP COLUMN IF EXISTS date_declined,
        DROP COLUMN IF EXISTS canceled_by_guid,
        DROP CONSTRAINT IF EXISTS "order_job_dispatches_canceled_by_guid_foreign",
        DROP CONSTRAINT IF EXISTS "order_job_dispatches_is_declined",
        DROP CONSTRAINT IF EXISTS "order_job_dispatches_is_accepted",
        DROP CONSTRAINT IF EXISTS "order_job_dispatches_is_canceled";
    `);
};
