const function_name = 'rcg_order_number_assign';

exports.up = function (knex)
{
    return knex.raw(`
    CREATE OR REPLACE FUNCTION rcg_tms.${function_name}()
        RETURNS trigger
        LANGUAGE 'plpgsql'
        COST 100
        STABLE NOT LEAKPROOF
    AS $BODY$
    BEGIN
        IF (TG_OP = 'INSERT') THEN
            NEW.number = rcg_tms.rcg_next_order_number();
        ELSEIF (TG_OP = 'UPDATE') THEN
        -- do not allow users to change the guid once it is assigned
            IF (NEW.number <> OLD.number ) THEN
                NEW.number = OLD.number;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $BODY$;

    COMMENT ON FUNCTION rcg_tms.${function_name}()
        IS 'Assigns the order the next available order number and prevents changing it';`);
};

exports.down = function (knex)
{
    return knex.raw(`DROP FUNCTION rcg_tms.${function_name}();`);
};
