class Carrier
{
    constructor(data)
    {
        // booleans
        this.approved = data.approved;
        this.in_blacklist = data.blacklist;
        this.preferred = data.preferred;

        this.insurance_expires_at = data.insuranceExpiration;
        this.custom_external_id = data.sfId;
        this.usdot_number; data.dotNumber;
    }
}

module.exports = Carrier;