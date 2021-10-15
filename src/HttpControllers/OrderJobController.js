const NotesService = require('../Services/NotesService');

class OrderJobController
{
    static async getJobNotes(req, res)
    {
        const result = await NotesService.getJobNotes(req.params.jobGuid);

        res.status(200).json(result);
    }
}

module.exports = OrderJobController;