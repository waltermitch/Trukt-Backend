const TABLE_NAME = 'invoice_bill_line_links';
const LINE_TABLE_NAME = 'invoice_bill_lines';
exports.up = function (knex)
{
    return knex.raw(`
        ALTER TABLE rcg_tms.${TABLE_NAME}
		DROP CONSTRAINT "invoice_bill_line_links_line1_guid_foreign",
		DROP CONSTRAINT "invoice_bill_line_links_line2_guid_foreign";

        ALTER TABLE rcg_tms.${TABLE_NAME}
        ADD CONSTRAINT "invoice_bill_line_links_line1_guid_foreign" FOREIGN KEY (line1_guid) REFERENCES rcg_tms.${LINE_TABLE_NAME} (guid) ON DELETE CASCADE,
	    ADD CONSTRAINT "invoice_bill_line_links_line2_guid_foreign" FOREIGN KEY (line2_guid) REFERENCES rcg_tms.${LINE_TABLE_NAME} (guid) ON DELETE CASCADE;
    `);
};

exports.down = function (knex)
{
    return knex.raw(`
	   	ALTER TABLE rcg_tms.${TABLE_NAME}
		DROP CONSTRAINT "invoice_bill_line_links_line1_guid_foreign",
		DROP CONSTRAINT "invoice_bill_line_links_line2_guid_foreign";

        ALTER TABLE rcg_tms.${TABLE_NAME}
	   	ADD CONSTRAINT "invoice_bill_line_links_line1_guid_foreign" FOREIGN KEY (line1_guid) REFERENCES rcg_tms.${LINE_TABLE_NAME} (guid),
		ADD	CONSTRAINT "invoice_bill_line_links_line2_guid_foreign" FOREIGN KEY (line2_guid) REFERENCES rcg_tms.${LINE_TABLE_NAME} (guid);
    `);
};
