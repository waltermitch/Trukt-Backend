
const function_name = 'job_status_change_trigger'
const table_name = 'order_jobs'

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION rcg_tms.${function_name}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 100
        AS $function$
        BEGIN
                IF (TG_OP = 'UPDATE') THEN
                    IF (NEW.status <> OLD.status) THEN
                    PERFORM pg_notify('job_status_change',row_to_json((select d from (select new.guid, new.status) d))::text);
                    END IF;
                END IF;
            RETURN NEW;
        END;
        $function$;

        CREATE TRIGGER rcg_order_job_status_change
            AFTER UPDATE
            ON rcg_tms.${table_name}
            FOR EACH ROW
            EXECUTE FUNCTION rcg_tms.${function_name}();

        COMMENT ON TRIGGER rcg_order_job_status_change ON rcg_tms.${table_name}
            IS 'Notify on job status change';

        COMMENT ON FUNCTION rcg_tms.${function_name}()
            IS 'Triggers Notification';`);
};

exports.down = function (knex)
{
    return knex.raw(`  
    DROP TRIGGER rcg_order_job_status_change ON rcg_tms.order_jobs;
    
    DROP FUNCTION rcg_tms.${function_name}();`);
};
