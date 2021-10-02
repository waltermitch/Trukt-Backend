const FUNCTION_NAME = 'rcg_order_job_number_assign';
const SCHEMA_NAME = 'rcg_tms';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        COST 100
        STABLE NOT LEAKPROOF
    AS $BODY$
    DECLARE 
        order_number varchar;
    BEGIN
        IF (TG_OP = 'INSERT') THEN
            IF (NEW.number IS NULL) THEN 
                SELECT number INTO order_number FROM ${SCHEMA_NAME}.orders WHERE orders.guid = NEW.order_guid;
                NEW.number = ${SCHEMA_NAME}.rcg_next_order_job_number(order_number);
            END IF;
        ELSEIF (TG_OP = 'UPDATE') THEN
        -- do not allow users to change the order job number once it is assigned
            IF (NEW.number <> OLD.number ) THEN
                NEW.number = OLD.number;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $BODY$;

    COMMENT ON FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
        IS 'Assigns the order job the next available order job number and prevents changing it';`);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}();`);
};
