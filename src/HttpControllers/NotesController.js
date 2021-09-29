const NotesService = require('../Services/NotesService');

class NotesController
{
    static async createNoteByGuid(req, res)
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
            res.status(400);
            res.json(error);
        }
    }

    static async updateNote(req, res)
    {
        try
        {
            const response = await NotesService.updateNote(req.params.noteGuid, req.body);
            res.status(200);
            res.json(response);
        }
        catch (error)
        {
            if (error.message == 'Note does not exist')
            {
                res.status(404);
                res.json('Note does not exist');
            }
            else
            {
                res.status(400);
                res.json(error);
            }
        }
    }

    static async deleteNote(req, res)
    {
        try
        {
            await NotesService.deleteNote(req.params.noteGuid);
            res.status(204);
            res.send();
        }
        catch (error)
        {
            res.status(404);
            res.json('Note does not exist');
        }
    }
}

module.exports = NotesController;