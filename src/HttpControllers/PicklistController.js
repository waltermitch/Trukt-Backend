const PicklistService = require('../Services/PicklistService');
const HttpRouteController = require('./HttpRouteController');
const fs = require('fs');

const localPicklistPath = './localdata/picklists.json';
let picklists;

// const fs = require('fs');
// const BaseModel = require('../Models/BaseModel');
// const https = require('https');

// const knex = BaseModel.knex();

// // creating an axios connection directly because this will not be reused
// // as far as we can tell for now
// const opts = {
//     httpsAgent: new https.Agent({ keepAlive: true }),
//     baseURL: process.env['azure.loadboard.baseurl'],
//     headers: {
//         'x-functions-key': process.env['azure.loadboard.funcCode']
//     }
// };
// const lbConn = require('axios').create(opts);

// let picklists;
// const localPicklistPath = './localdata/picklists.json';

class PicklistController extends HttpRouteController
{
    static async getAll(req, res)
    {
        // first check if the picklist is in memory
        if (!picklists)
        {
            if (!fs.existsSync(localPicklistPath))
            {
                // fetch from database
                picklists = await PicklistService.updatePicklists();
            }
            else
            {
                // fetch from file
                picklists = JSON.parse(fs.readFileSync(localPicklistPath, 'utf8'));
            }
        }

        const finalBody = {
            body: picklists,
            status: 200
        };

        res.status(200).json(finalBody);
    }

    static async update(req, res)
    {
        try
        {
            await PicklistService.updatePicklists();
            res.status(201).send();
        }
        catch (err)
        {
            res.status(500).send(err);
        }
    }
}

const controller = new PicklistController();
module.exports = controller;