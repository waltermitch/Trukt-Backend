const NotesService = require('../Services/NotesService');
const Notes = require('../Models/Notes');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const Case = require('../Models/Case');

class NotesController
{
    static async createNoteByGuid(req, res, next)
    {
        try
        {
            const noteToCreate = Notes.fromJson(req.body);
            let parentModel = undefined;
            switch (req.params.object)
            {
                case 'job':
                    parentModel = OrderJob;
                    break;
                case 'order':
                    parentModel = Order;
                    break;
                case 'case':
                    parentModel = Case;
                    break;
            }

            const parent = new parentModel();
            parent.guid = req.params.objectGuid;

            const response = await NotesService.genericCreator(req.params.object, parent, noteToCreate, req.session.userGuid);
            res.status(200);
            res.json(response);
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