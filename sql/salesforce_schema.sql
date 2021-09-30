CREATE SCHEMA salesforce;

CREATE SEQUENCE salesforce.account_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

CREATE SEQUENCE salesforce.contact_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

CREATE SEQUENCE salesforce.recordtype_id_seq
	INCREMENT BY 1
	MINVALUE 1
	MAXVALUE 2147483647
	START 1
	CACHE 1
	NO CYCLE;

CREATE TABLE salesforce.account (
	primary_contact__c varchar(18) NULL,
	pending_cancellation_date__c date NULL,
	lastname varchar(80) NULL,
	shippinglongitude float8 NULL,
	carrier_type__c varchar(24) NULL,
	preferred__c bool NULL,
	notes__c text NULL,
	bank_account_name__c varchar(255) NULL,
	shippingstate varchar(80) NULL,
	dot_number__c varchar(50) NULL,
	pickup_notes__c varchar(255) NULL,
	counterparty_guid__c varchar(255) NULL,
	uses_factoring_company__c bool NULL,
	bank_account_number__c varchar(255) NULL,
	dat_username__c varchar(255) NULL,
	parentid varchar(18) NULL,
	recordtypeid varchar(18) NULL,
	shippingpostalcode varchar(20) NULL,
	billingcity varchar(40) NULL,
	blacklist__c bool NULL,
	sla_serial_number__c varchar(10) NULL,
	email__c varchar(80) NULL,
	billinglatitude float8 NULL,
	accountsource varchar(255) NULL,
	shippingcountry varchar(80) NULL,
	shippinggeocodeaccuracy varchar(255) NULL,
	payment_method__c varchar(255) NULL,
	business_type__c varchar(255) NULL,
	"name" varchar(255) NULL,
	suite__c varchar(255) NULL,
	auction_id__c varchar(40) NULL,
	insurance_on_file__c bool NULL,
	cargo_insurance_expiration__c date NULL,
	order_instructions__c text NULL,
	job_title__c varchar(255) NULL,
	delivery_notes__c varchar(255) NULL,
	phone varchar(40) NULL,
	truckstop_username__c varchar(255) NULL,
	certificate_holder__c varchar(255) NULL,
	insurance_expiration__c date NULL,
	isdeleted bool NULL,
	systemmodstamp timestamp NULL,
	mc_number__c varchar(11) NULL,
	shippingstreet varchar(255) NULL,
	cell_phone__c varchar(40) NULL,
	vendor_type__c varchar(255) NULL,
	billingpostalcode varchar(20) NULL,
	autoims_client_id__c varchar(25) NULL,
	billinglongitude float8 NULL,
	bank_account_type__c varchar(255) NULL,
	sla_days__c float8 NULL,
	payment_terms__c varchar(255) NULL,
	createddate timestamp NULL,
	billingstate varchar(80) NULL,
	accountnumber varchar(40) NULL,
	azure_id__c varchar(100) NULL,
	shippingcity varchar(40) NULL,
	shippinglatitude float8 NULL,
	guid__c varchar(125) NULL,
	qb_id__c varchar(20) NULL,
	operations_email__c varchar(80) NULL,
	"type" varchar(255) NULL,
	website varchar(255) NULL,
	billingcountry varchar(80) NULL,
	firstname varchar(40) NULL,
	sla__c varchar(255) NULL,
	sla_expiration_date__c date NULL,
	dba_name__c varchar(255) NULL,
	description text NULL,
	billinggeocodeaccuracy varchar(255) NULL,
	rating varchar(255) NULL,
	photourl varchar(255) NULL,
	fax varchar(40) NULL,
	active__c bool NULL,
	bank_routing_number__c varchar(50) NULL,
	billingstreet varchar(255) NULL,
	auto_insurance_expiration__c date NULL,
	sfid varchar(18) NULL COLLATE "ucs_basic",
	id serial NOT NULL,
	"_hc_lastop" varchar(32) NULL,
	"_hc_err" text NULL,
	brokerauthority__c bool NULL,
	client_account_manager__c varchar(18) NULL,
	internal_notes__c text NULL,
	loadboard_instructions__c text NULL,
	ownerid varchar(18) NULL,
	sync_in_super__c bool NULL,
	sd_guid__c varchar(100) NULL,
	user_role__c varchar(255) NULL,
	sc_id__c varchar(100) NULL,
	status__c varchar(255) NULL,
	CONSTRAINT account_pkey PRIMARY KEY (id)
);
CREATE INDEX hc_idx_account_systemmodstamp ON salesforce.account USING btree (systemmodstamp);
CREATE UNIQUE INDEX hcu_idx_account_guid__c ON salesforce.account USING btree (guid__c);
CREATE UNIQUE INDEX hcu_idx_account_sfid ON salesforce.account USING btree (sfid);

CREATE TABLE salesforce.contact (
	primary_contact__c bool NULL,
	lastname varchar(80) NULL,
	otherstate varchar(80) NULL,
	mailingpostalcode varchar(20) NULL,
	mailinglongitude float8 NULL,
	mailingstate varchar(80) NULL,
	recordtypeid varchar(18) NULL,
	othercountry varchar(80) NULL,
	othergeocodeaccuracy varchar(255) NULL,
	accountid varchar(18) NULL,
	otherpostalcode varchar(20) NULL,
	mailingcountry varchar(80) NULL,
	"name" varchar(121) NULL,
	sd_guid__c varchar(255) NULL,
	mailinggeocodeaccuracy varchar(255) NULL,
	mobilephone varchar(40) NULL,
	accounting_contact__c bool NULL,
	phone varchar(40) NULL,
	mailingstreet varchar(255) NULL,
	ispersonaccount bool NULL,
	isdeleted bool NULL,
	homephone varchar(40) NULL,
	systemmodstamp timestamp NULL,
	department varchar(80) NULL,
	otherstreet varchar(255) NULL,
	createddate timestamp NULL,
	mailingcity varchar(40) NULL,
	mailinglatitude float8 NULL,
	leadsource varchar(255) NULL,
	title varchar(128) NULL,
	guid__c varchar(100) NULL,
	othercity varchar(40) NULL,
	firstname varchar(40) NULL,
	otherlatitude float8 NULL,
	email varchar(80) NULL,
	description text NULL,
	photourl varchar(255) NULL,
	fax varchar(40) NULL,
	otherphone varchar(40) NULL,
	otherlongitude float8 NULL,
	sfid varchar(18) NULL COLLATE "ucs_basic",
	id serial NOT NULL,
	"_hc_lastop" varchar(32) NULL,
	"_hc_err" text NULL,
	CONSTRAINT contact_pkey PRIMARY KEY (id)
);
CREATE INDEX hc_idx_contact_systemmodstamp ON salesforce.contact USING btree (systemmodstamp);
CREATE UNIQUE INDEX hcu_idx_contact_guid__c ON salesforce.contact USING btree (guid__c);
CREATE UNIQUE INDEX hcu_idx_contact_sfid ON salesforce.contact USING btree (sfid);

CREATE TABLE salesforce.recordtype (
	createddate timestamp NULL,
	"name" varchar(80) NULL,
	systemmodstamp timestamp NULL,
	isactive bool NULL,
	sobjecttype varchar(255) NULL,
	description varchar(255) NULL,
	sfid varchar(18) NULL COLLATE "ucs_basic",
	id serial NOT NULL,
	"_hc_lastop" varchar(32) NULL,
	"_hc_err" text NULL,
	CONSTRAINT recordtype_pkey PRIMARY KEY (id)
);
CREATE INDEX hc_idx_recordtype_systemmodstamp ON salesforce.recordtype USING btree (systemmodstamp);
CREATE UNIQUE INDEX hcu_idx_recordtype_sfid ON salesforce.recordtype USING btree (sfid);