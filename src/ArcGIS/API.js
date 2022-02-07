const HTTPS = require('../AuthController');

const API_KEY = process.env['arcgis.apikey'];
const NODE_ENV = process.env.NODE_ENV;

const opts =
{
    url: 'https://geocode.arcgis.com',
    params:
    {
        f: 'json',
        token: NODE_ENV != 'local' ? API_KEY : ''
    }
};

const geo = new HTTPS(opts).connect();

class ArcGIS
{
    static async findMatches(address)
    {
        // clean address to avoid errors
        // remove the following characters: #, *, &, $, @, ^, !, ?, >, <, %
        address = address.replace(/[#*&$@^!??><%]/g, '');

        // getting location data
        const { data } = await geo.get(`/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?sourceCountry=USA,CAN&outFields=*&SingleLine=${address}`);

        // handle error
        if (data?.error || !data.candidates || !data.candidates.length)
            throw { 'status': 400, 'data': data?.candidates ? { 'matches': data?.candidates } : data };

        return data.candidates || [];
    }

    /**
     * Latitude is arcgis.Y
     * Longitude is arcgis.X
     * https://developers.arcgis.com/rest/geocode/api-reference/geocoding-find-address-candidates.htm#ESRI_SECTION1_CF39B0C8FC2547C3A52156F509C555FC
     */
    static parseGeoCoords(arcgisTerminal)
    {
        return {
            lat: parseFloat(arcgisTerminal.location.y).toFixed(7),
            long: parseFloat(arcgisTerminal.location.x).toFixed(7)
        };
    }
}

module.exports = ArcGIS;