const OrderJob = require('../Models/OrderJob');
const pubsub = require('../Azure/PubSub');
const Notes = require('../Models/Notes');
const Order = require('../Models/Order');

class NotesService
{
    // creation of internal notes attached to job
    static async createInternalNotes(jobGuid, notePayload, currentUser)
    {
        // create job model object to link notes to job
        const job = OrderJob.fromJson({ guid: jobGuid });

        // generating internal notes
        return await NotesService.genericCreator('job', job, notePayload, currentUser);
    }

    // creation of external notes, client notes
    static async createClientNotes(orderGuid, notePayload, currentUser)
    {
        // create order model object to link notes to order
        const order = Order.fromJson({ guid: orderGuid });

        // generating cleint notes
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

        // find note by note GUID and patch the note and return job/order guid
        const updatedNote = await Notes.query().patchAndFetchById(noteGuid, note).withGraphFetched('[job, order]');

        // not doesn't exist
        if (updatedNote == undefined)
        {
            throw new Error('Note does not exist');
        }

        // assigning guid
        const guid = updatedNote.job?.guid || updatedNote.order?.guid;

        // removing job/order fields to update sub with payload
        delete updatedNote.order;
        delete updatedNote.job;

        // update pubsub accordingly
        await pubsub.publishToGroup(guid, { object: 'note', data: updatedNote });
    }

    // function to delete not
    static async deleteNote(noteGuid)
    {
        // find note being that needs to be deleted return job/order guid
        const updatedNote = await Notes.query().patchAndFetchById(noteGuid, { isDeleted: true }).withGraphFetched('[job, order]');

        // not doesn't exist
        if (updatedNote == undefined)
        {
            throw new Error('Note does not exist');
        }

        // assigning guid
        const guid = updatedNote.job?.guid || updatedNote.order?.guid;

        // removing job/order fields to update sub with payload
        delete updatedNote.order;
        delete updatedNote.job;

        // update pubsub accordingly
        await pubsub.publishToGroup(guid, { object: 'note', data: updatedNote.guid });
    }

    // to create any note
    static async genericCreator(name, model, notePayload, currentUser)
    {
        // composing payload
        const notes = Notes.fromJson(notePayload);

        // adding current user
        notes.setCreatedBy(currentUser);

        // linking models to propper table order/job
        notes.graphLink(name, model);

        // insert note into table with conjustion
        const createdNote = await Notes.query().insertGraph(notes, { allowRefs: true, relate: true });

        // update pubsub accordingly
        await pubsub.publishToGroup(`${model.guid}`, { object: 'note', data: createdNote });

        // return full note
        return createdNote;
    }
}

module.exports = NotesService;