const FUNCTION_NAME = 'rcg_forbid_soft_delete_update';
exports.up = function(knex)
{
  return knex.raw(`
    CREATE OR REPLACE FUNCTION rcg_tms.${FUNCTION_NAME}()
        returns trigger
        VOLATILE NOT LEAKPROOF
        AS $function$
    DECLARE
    BEGIN
        IF (TG_OP = 'UPDATE') THEN
            IF (TG_WHEN = 'BEFORE') THEN
                IF(OLD.is_deleted IS TRUE AND NEW.is_deleted IS TRUE) THEN
                    RAISE EXCEPTION 'Updating forbidden on soft deleted record with guid of %', OLD.guid;
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $function$ LANGUAGE plpgsql;

    COMMENT ON FUNCTION rcg_tms.${FUNCTION_NAME}()
        IS 'Prevents updating records that are soft deleted. Function is reusable and can be called by any trigger.';
  `);
};

exports.down = function(knex)
{
    return knex.raw(`
        DROP FUNCTION rcg_tms.${FUNCTION_NAME}();
    `);
};
