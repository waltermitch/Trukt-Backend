const { DateTime } = require('luxon');

class Invoice
{
    constructor(data)
    {
        this.time = Invoice.setDate();
        this.tariff = data.total?.toString();
        this.description = data.description;
        this.orderNumber = data.orderNumber;
        this.poNumber = data.poNumber;
        this.vin = data.vin;

        // courtesy of coupa
        const payload = `<?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE cXML SYSTEM "http://xml.cXML.org/schemas/cXML/1.2.020/InvoiceDetail.dtd">
                <cXML version="1.0" payloadID="1240598937@devtrunk.coupahost.com" timestamp="${this.time}">
                    <Header>
                            <From>
                                <Credential domain="RCGProd">
                                    <Identity>RCGProd</Identity>
                                </Credential>
                            </From>
                            <To>
                                <Credential domain="RCGProd">
                                    <Identity>RCGProd</Identity>
                                </Credential>
                            </To>
                            <Sender>
                                <Credential domain="RCGProd">
                                    <Identity>RCGProd</Identity>
                                    <SharedSecret>RCGProd</SharedSecret>
                                </Credential>
                                <UserAgent>Your Very Own Agent 1.23</UserAgent>
                            </Sender>
                        </Header>
                    <Request deploymentMode="production">
                        <InvoiceDetailRequest>
                            <InvoiceDetailRequestHeader invoiceID="${this.orderNumber}" purpose="standard" operation="new" invoiceDate="${this.time}">
                                <InvoiceDetailHeaderIndicator />
                                <InvoiceDetailLineIndicator isAccountingInLine="yes" />
                                <PaymentTerm payInNumberOfDays="7" />
                            </InvoiceDetailRequestHeader>
                                <InvoiceDetailOrder>
                                    <InvoiceDetailOrderInfo>
                                        <OrderReference>
                                            <DocumentReference payloadID="${this.poNumber}" />
                                        </OrderReference>
                                    </InvoiceDetailOrderInfo>
                                    <InvoiceDetailItem invoiceLineNumber="1" quantity="1">
                                        <UnitOfMeasure>EA</UnitOfMeasure>
                                            <UnitPrice>
                                                <Money currency="USD">${this.tariff}</Money>
                                            </UnitPrice>
                                            <InvoiceDetailItemReference lineNumber="1">
                                                <ItemID>
                                                    <SupplierPartID>${this.vin}</SupplierPartID>
                                                </ItemID>
                                                <Description xml:lang="en-US">${this.description}</Description>
                                            </InvoiceDetailItemReference>
                                            <SubtotalAmount>
                                                <Money currency="USD">${this.tariff}</Money>
                                            </SubtotalAmount>
                                    </InvoiceDetailItem>
                            </InvoiceDetailOrder>
                            <InvoiceDetailSummary>
                                <SubtotalAmount>
                                    <Money currency="USD">${this.tariff}</Money>
                                </SubtotalAmount>
                                <Tax>
                                    <Money currency="USD">0</Money>
                                    <Description xml:lang="en">total tax</Description>
                                    <TaxDetail purpose="tax" category="CA" percentageRate="8.25" taxPointDate="${this.time}">
                                        <TaxableAmount>
                                            <Money currency="USD">0</Money>
                                        </TaxableAmount>
                                        <TaxAmount>
                                            <Money currency="USD">0</Money>
                                        </TaxAmount>
                                        <TaxLocation xml:lang="en">CA</TaxLocation>
                                    </TaxDetail>
                                </Tax >
                            <SpecialHandlingAmount>
                                <Money currency="USD">0</Money>
                            </SpecialHandlingAmount>
                            <ShippingAmount>
                                <Money currency="USD">0</Money>
                            </ShippingAmount>
                            <NetAmount>
                                <Money currency="USD" />
                            </NetAmount>
                        </InvoiceDetailSummary >
                    </InvoiceDetailRequest >
                </Request >
            </cXML >`;

        return payload;
    }

    static setDate(date)
    {
        return (date ? DateTime.fromISO(date).toString() : DateTime.utc().toString()).substr(0, 19) + '+00:00';
    }
}

module.exports = Invoice;