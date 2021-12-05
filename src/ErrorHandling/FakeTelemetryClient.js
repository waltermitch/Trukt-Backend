// The purpose of this class is to act as a fake Application Insights
// telemetry client. This client has all the same methods as the real
// client, but this one does not do anything.
class FakeTelemetryClient
{
    constructor() {}

    trackAvailability() {}

    trackPageView() {}

    trackTrace() {}
    
    trackMetric() {}
  
    trackException() {}

    trackEvent() {}

    trackRequest() {}

    trackDependency() {}

    flush() {}

    track() {}

    setAutoPopulateAzureProperties() {}

    getAuthorizationHandler() {}

    addTelemetryProcessor() {}

    clearTelemetryProcessors() {}

    getStatsbeat() {}
}

module.exports = new FakeTelemetryClient();