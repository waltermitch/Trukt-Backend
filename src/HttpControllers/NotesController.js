const NotesService = require('../Services/NotesService');

class NotesController
{
    static async createNoteByGuid(req, res, next)
    {
        try
        {
            // logic to create 2 type of notes if job then it is internal notes order is external notes
            if (req.params.object == 'job')
            {
                const response = await NotesService.createInternalNotes(req.params.objectGuid, req.body, req.session.userGuid);

                res.status(200);
                res.json(response);
            }
            else if (req.params.object == 'order')
            {
                const response = await NotesService.createClientNotes(req.params.objectGuid, req.body, req.session.userGuid);

                res.status(200);
                res.json(response);
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async updateNote(req, res, next)
    {
        try
        {
            const response = await NotesService.updateNote(req.params.noteGuid, req.body);

            res.status(200);
            res.json(response);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async deleteNote(req, res, next)
    {
        try
        {
            await NotesService.deleteNote(req.params.noteGuid);

            res.status(204);
            res.send();
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = NotesController;