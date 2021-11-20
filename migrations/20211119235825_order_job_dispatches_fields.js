const FUNCTION_NAME = 'rcg_order_job_dispatch_actions_timestamps';
const SCHEMA_NAME = 'rcg_tms';
const TABLE_NAME = 'order_job_dispatches';

exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE ${SCHEMA_NAME}.${TABLE_NAME}
        ADD COLUMN is_valid boolean NOT NULL DEFAULT true,
        ADD COLUMN is_declined boolean NOT NULL DEFAULT false,
        ADD COLUMN date_accepted timestamptz,
        ADD COLUMN date_canceled timestamptz,
        ADD COLUMN date_declined timestamptz,
        ADD COLUMN canceled_by_guid uuid,
        add constraint "order_job_dispatches_canceled_by_guid_foreign" FOREIGN KEY (canceled_by_guid) REFERENCES rcg_tms.tms_users (guid),
        ADD CONSTRAINT "order_job_dispatches_is_declined" CHECK ((is_declined = true AND is_accepted = false AND is_canceled = false) OR is_declined = false),
        ADD CONSTRAINT "order_job_dispatches_is_accepted" CHECK ((is_declined = false AND is_accepted = true AND is_canceled = false) OR is_accepted = false),
        ADD CONSTRAINT "order_job_dispatches_is_canceled" CHECK ((is_declined = false AND is_accepted = false AND is_canceled = true) OR is_canceled = false);

        CREATE OR REPLACE FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 1
            STABLE NOT LEAKPROOF
        AS $BODY$
        BEGIN
            -- if new data gets created everything is null
            IF (TG_OP = 'INSERT') THEN
                NEW.date_declined = NULL;
                NEW.date_accepted = NULL;
                NEW.date_canceled = NULL;
            ELSEIF (TG_OP = 'UPDATE') THEN
                -- update when the is_accepted is changed from false to true
                IF (NEW.is_accepted is true AND OLD.is_accepted is false) THEN
                    NEW.date_accepted = now();
                END IF;
                -- update when the is_canceled is changed from false to true
                IF (NEW.is_canceled is true AND OLD.is_canceled is false) THEN
                    NEW.date_canceled = now();
                END IF;
                -- update when the is_declined is changed from false to true
                IF (NEW.is_declined is true AND OLD.is_declined is false) THEN
                    NEW.date_declined = now();
                END IF;
                NEW.date_updated = now();
            END IF;
            RETURN NEW;
        END;
        $BODY$;

        COMMENT ON FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}()
            IS 'sets and manages the declined, accepted, and canceled timestamp columns';

        CREATE TRIGGER rcg_order_job_dispatches_action_timestamp_trigger
            BEFORE INSERT OR UPDATE
            ON ${SCHEMA_NAME}.${TABLE_NAME}
            FOR EACH ROW
            EXECUTE FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME}();

        COMMENT ON TRIGGER rcg_order_job_dispatches_action_timestamp_trigger ON ${SCHEMA_NAME}.${TABLE_NAME}
            IS 'sets the date_canceled, date_declined, date_accepted columns';

        `);
};

exports.down = function (knex)
{
    return knex.raw(`
        DROP TRIGGER IF EXISTS rcg_order_job_dispatches_action_timestamp_trigger ON ${SCHEMA_NAME}.${TABLE_NAME};
        DROP FUNCTION ${SCHEMA_NAME}.${FUNCTION_NAME};
        ALTER TABLE rcg_tms.${TABLE_NAME}
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
