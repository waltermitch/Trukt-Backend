const PicklistService = require('../Services/PicklistService');
const fs = require('fs');

const localPicklistPath = './localdata/picklists.json';
let picklists;

class PicklistController
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

        res.status(200).json(picklists);
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

module.exports = PicklistController;