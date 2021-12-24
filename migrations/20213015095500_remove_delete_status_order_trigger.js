const FUNCTION_NAME = 'rcg_update_order_job_status';
const TRIGGER_NAME = 'rcg_update_order_job_status_trigger';
const TABLE_NAME = 'order_jobs';

exports.up = function (knex)
{
    return knex.raw(`
        CREATE OR REPLACE FUNCTION rcg_tms.${FUNCTION_NAME}()
            returns trigger 
            VOLATILE NOT LEAKPROOF
            AS $function$
        DECLARE
            should_update_order_to_same_status boolean := false;
            order_guid_found uuid;
            new_is_on_hold_value boolean := false;
            new_is_ready_value boolean := false;
            new_is_canceled_value boolean := false;
            new_is_deleted_value boolean := false;
        BEGIN

        IF (TG_OP = 'UPDATE' AND TG_WHEN = 'AFTER') THEN
            SELECT order_guid FROM rcg_tms.order_jobs WHERE guid = NEW.guid INTO order_guid_found;
            
            IF (NEW.is_ready = true) THEN
                select bool_or(is_ready) from rcg_tms.order_jobs
                where order_guid = order_guid_found
                into should_update_order_to_same_status;

                new_is_ready_value = true;
            ELSIF (NEW.is_canceled = true) THEN
                select bool_and(is_canceled) from rcg_tms.order_jobs
                where order_guid = order_guid_found
                into should_update_order_to_same_status;

                new_is_canceled_value = true;
            END IF;

            IF (should_update_order_to_same_status = true) THEN
                UPDATE rcg_tms.orders SET
                is_on_hold = new_is_on_hold_value,
                is_ready = new_is_ready_value,
                is_canceled = new_is_canceled_value,
                is_deleted = new_is_deleted_value,
				status = NEW.status,
                updated_by_guid = NEW.updated_by_guid
                where guid = order_guid_found;
            END IF;
        END IF;
        RETURN NEW;
        END;
        $function$ LANGUAGE plpgsql;
  `);
};

exports.down = function (knex)
{
    return knex.raw(`  
    DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON rcg_tms.${TABLE_NAME};
    DROP FUNCTION IF EXISTS rcg_tms.${FUNCTION_NAME}()`);
};
