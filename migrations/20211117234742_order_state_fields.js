
exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.orders
        DROP COLUMN IF EXISTS is_started,
        DROP COLUMN IF EXISTS is_completed,
        ADD COLUMN is_ready boolean NOT NULL DEFAULT false,
        ADD COLUMN is_on_hold boolean NOT NULL DEFAULT false,
        ADD COLUMN is_canceled boolean NOT NULL DEFAULT false,
        ADD COLUMN is_complete boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT "orders_tender_constraint" CHECK ((is_tender = true AND is_ready = false AND is_complete = false AND is_canceled = false AND is_on_hold = false ) OR is_tender = false),
        ADD CONSTRAINT "orders_ready_constraint" CHECK ((is_ready = true AND is_tender = false AND is_deleted = false AND is_canceled = false) OR is_ready = false),
        ADD CONSTRAINT "orders_deleted_constraint" CHECK ((is_deleted = true AND is_canceled = false AND is_complete = false) OR is_deleted = false),
        ADD CONSTRAINT "orders_cancel_constraint" CHECK ((is_canceled = true AND is_deleted = false AND is_complete = false ) OR is_canceled = false),
        ADD CONSTRAINT "orders_complete_constraint" CHECK ((is_complete = true AND is_deleted = false AND is_canceled = false AND is_on_hold = false) OR is_complete = false);

        ALTER TABLE rcg_tms.order_jobs
        DROP COLUMN IF EXISTS is_started,
        DROP COLUMN IF EXISTS is_completed,
        ADD COLUMN is_ready boolean NOT NULL DEFAULT false,
        ADD COLUMN is_on_hold boolean NOT NULL DEFAULT false,
        ADD COLUMN is_canceled boolean NOT NULL DEFAULT false,
        ADD COLUMN is_complete boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT "order_jobs_ready_constraint" CHECK ((is_ready = true AND is_deleted = false AND is_canceled = false) OR is_ready = false),
        ADD CONSTRAINT "order_jobs_deleted_constraint" CHECK ((is_deleted = true AND is_canceled = false AND is_complete = false) OR is_deleted = false),
        ADD CONSTRAINT "order_jobs_cancel_constraint" CHECK ((is_canceled = true AND is_deleted = false AND is_complete = false ) OR is_canceled = false),
        ADD CONSTRAINT "order_jobs_complete_constraint" CHECK ((is_complete = true AND is_ready = false AND is_deleted = false AND is_canceled = false AND is_on_hold = false) OR is_complete = false);
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.orders
        ADD COLUMN is_started boolean NOT NULL DEFAULT false,
        ADD COLUMN is_completed boolean NOT NULL DEFAULT false,
        DROP COLUMN IF EXISTS is_on_hold,
        DROP COLUMN IF EXISTS is_ready,
        DROP COLUMN IF EXISTS is_complete,
        DROP COLUMN IF EXISTS is_canceled,
        DROP CONSTRAINT IF EXISTS "orders_tender_constraint",
        DROP CONSTRAINT IF EXISTS "orders_ready_constraint",
        DROP CONSTRAINT IF EXISTS "orders_deleted_constraint",
        DROP CONSTRAINT IF EXISTS "orders_cancel_constraint",
        DROP CONSTRAINT IF EXISTS "orders_complete_constraint";

        ALTER TABLE rcg_tms.order_jobs
        ADD COLUMN is_started boolean NOT NULL DEFAULT false,
        ADD COLUMN is_completed boolean NOT NULL DEFAULT false,
        DROP COLUMN IF EXISTS is_on_hold,
        DROP COLUMN IF EXISTS is_ready,
        DROP COLUMN IF EXISTS is_complete,
        DROP COLUMN IF EXISTS is_canceled,
        DROP CONSTRAINT IF EXISTS "order_jobs_tender_constraint",
        DROP CONSTRAINT IF EXISTS "order_jobs_ready_constraint",
        DROP CONSTRAINT IF EXISTS "order_jobs_deleted_constraint",
        DROP CONSTRAINT IF EXISTS "order_jobs_cancel_constraint",
        DROP CONSTRAINT IF EXISTS "order_jobs_complete_constraint";
    `);
};
