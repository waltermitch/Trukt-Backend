const Notes = require('../Models/Notes');
const Order = require('../Models/Order');
const OrderJob = require('../Models/OrderJob');

class NotesService
{
    // creation of internal notes attached to job
    static async createInternalNotes(jobGuid, notePayload, currentUser)
    {
        // create job model object to link notes to job
        const job = OrderJob.fromJson({ guid: jobGuid });

        return await NotesService.genericCreator('job', job, notePayload, currentUser);
    }

    // creation of external notes, client notes
    static async createClientNotes(orderGuid, notePayload, currentUser)
    {
        // create order model object to link notes to order
        const order = Order.fromJson({ guid: orderGuid });

        return await NotesService.genericCreator('order', order, notePayload, currentUser);
    }

    // function for updating notes
    static async updateNote(noteGuid, notePayload)
    {
        // creating payload to update
        const note = {
            title: (notePayload.title || null),
            body: notePayload.body,
            type: notePayload.type,
            isDeleted: false
        };

        // find note by note GUID and patch the note
        const response = await Notes.query().findById(noteGuid).patch(note);

        // not doesn't exist
        if (response == 0)
        {
            throw new Error('Note does not exist');
        }
    }

    static async deleteNote(noteGuid)
    {
        // find note being that needs to be deleted
        const response = await Notes.query().findById(noteGuid).patch({ isDeleted: true });
        console.log(response);

        // not doesn't exist
        if (response == 0)
        {
            throw new Error('Note does not exist');
        }

        // return status 202 with no note
        return;
    }

    static async genericCreator(name, model, notePayload, currentUser)
    {
        const notes = Notes.fromJson(notePayload);
        notes.setCreatedBy(currentUser);
        notes.graphLink(name, model);
        const internalNote = await Notes.query().insertGraph(notes, { allowRefs: true, relate: true });
        return internalNote;
    }
}

module.exports = NotesService;