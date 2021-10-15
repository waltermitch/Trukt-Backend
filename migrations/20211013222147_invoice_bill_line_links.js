const TABLE_NAME = 'invoice_bill_line_links';
exports.up = function (knex)
{
    return knex.raw(`
        CREATE TABLE rcg_tms.${TABLE_NAME}
        (
            line1_guid uuid NOT NULL,
            line2_guid uuid NOT NULL,
            CONSTRAINT "invoice_bill_line_links_line1_guid_foreign" FOREIGN KEY (line1_guid) REFERENCES rcg_tms.invoice_bill_lines (guid),
            CONSTRAINT "invoice_bill_line_links_line2_guid_foreign" FOREIGN KEY (line2_guid) REFERENCES rcg_tms.invoice_bill_lines (guid),
		    CONSTRAINT "invoice_bill_line_links_pkey" PRIMARY KEY (line1_guid, line2_guid),
			CONSTRAINT "invoice_bill_line_links_line1_guid_line2_guid_unique" UNIQUE (line1_guid, line2_guid),
            CONSTRAINT "line_to_same_line" CHECK (line1_guid <> line2_guid)
        );

        CREATE OR REPLACE FUNCTION rcg_tms.invoice_bill_links_func()
            RETURNS trigger
            LANGUAGE 'plpgsql'
            COST 100
            VOLATILE NOT LEAKPROOF
        AS $BODY$
        DECLARE exist_inverse integer;
        BEGIN
            IF(TG_OP = 'INSERT') THEN
                -- check for inverse links
                SELECT count(*) INTO exist_inverse
                FROM rcg_tms.invoice_bill_line_links as link
                WHERE link.line1_guid = NEW.line2_guid AND link.line2_guid = NEW.line1_guid;
                -- if none exist allow insertion
                IF(exist_inverse > 0) THEN
                    RAISE EXCEPTION 'Inverse exists: (%, %), cannot create link', NEW.line1_guid, NEW.line2_guid;
                END IF;
            ELSEIF(TG_OP = 'UPDATE') THEN
                RAISE EXCEPTION 'Updating records on this table is forbidden.';
            END IF;
            RETURN NEW;
        END;
        $BODY$;

        COMMENT ON FUNCTION rcg_tms.invoice_bill_links_func()
            IS 'So lines are not linked to themselves, and inverse relationship does not exist.';

        CREATE TRIGGER rcg_invoice_bill_links_trigger
            BEFORE INSERT OR UPDATE
            ON rcg_tms.${TABLE_NAME}
            FOR EACH ROW
            EXECUTE FUNCTION rcg_tms.invoice_bill_links_func();

        COMMENT ON TRIGGER rcg_invoice_bill_links_trigger ON rcg_tms.${TABLE_NAME}
            IS 'So lines are not linked to themselves, and inverse relationship does not exist.';
    `);
};

exports.down = function (knex)
{
    return knex
        .raw(`
            DROP TRIGGER IF EXISTS rcg_invoice_bill_links_trigger ON rcg_tms.${TABLE_NAME};
            DROP FUNCTION IF EXISTS rcg_tms.invoice_bill_links_func;
            DROP TABLE IF EXISTS rcg_tms.${TABLE_NAME};
        `);
};