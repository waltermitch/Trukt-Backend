const FUNCTION_NAME = 'rcg_order_number_assign';
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
    BEGIN
        IF (TG_OP = 'INSERT') THEN
            IF (NEW.number IS NULL) THEN
                NEW.number = ${SCHEMA_NAME}.rcg_next_order_number();
            END IF;
        ELSEIF (TG_OP = 'UPDATE') THEN
        -- do not allow users to change the order number once it is assigned
            IF (NEW.number <> OLD.number ) THEN
                NEW.number = OLD.number;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $BODY$;

    COMMENT ON FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
        IS 'Assigns the order the next available order number and prevents changing it';`);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}();`);
};
