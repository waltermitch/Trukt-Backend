
exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.loadboard_requests
        RENAME COLUMN is_active TO is_valid;

        ALTER TABLE rcg_tms.loadboard_requests
        ADD CONSTRAINT "loadboard_requests_accept_constraint" CHECK ((is_accepted = true AND is_declined = false AND  is_canceled = false) OR is_accepted = false),
        ADD CONSTRAINT "loadboard_requests_cancel_constraint" CHECK ((is_canceled = true AND is_accepted = false AND is_declined = false) OR is_canceled = false),
        ADD CONSTRAINT "loadboard_requests_decline_constraint" CHECK ((is_declined = true AND is_accepted = false AND is_canceled = false) OR is_declined = false);
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.loadboard_requests
        RENAME COLUMN is_valid TO is_active;
        
        ALTER TABLE rcg_tms.loadboard_requests
        DROP CONSTRAINT IF EXISTS "loadboard_requests_accept_constraint",
        DROP CONSTRAINT IF EXISTS "loadboard_requests_cancel_constraint",
        DROP CONSTRAINT IF EXISTS "loadboard_requests_decline_constraint";
    `);
};
