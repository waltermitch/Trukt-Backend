const { NotFoundError } = require('../ErrorHandling/Exceptions');
const PubSubService = require('../Services/PubSubService');
const OrderJob = require('../Models/OrderJob');
const Notes = require('../Models/Notes');
const Order = require('../Models/Order');
const { NOTES_TYPES } = require('../Models/Notes');
const { raw } = require('objection');
const Case = require('../Models/Case');
const User = require('../Models/User');

class NotesService
{
    /**
     * @description creation of internal notes attached to job
     *
     * @param {OrderJob} job
     * @param {Notes} note
     * @param {String | User} currentUser
     * @returns {Notes}
     */
    static createInternalNotes(job, note, currentUser)
    {

        // generating internal notes
        return NotesService.genericCreator('job', job, note, currentUser);
    }

    /**
     * @description creation of external notes, client notes
     *
     * @param {Order} order
     * @param {Notes} note
     * @param {String | User} currentUser
     * @returns {Notes}
     */
    static createClientNotes(order, note, currentUser)
    {
        return NotesService.genericCreator('order', order, note, currentUser);
    }

    /**
     * @description creation of notes attached to case
     *
     * @param {Case} case_
     * @param {Notes} note
     * @param {String | User} currentUser
     * @returns {Notes}
     */
    static createCaseNotes(case_, note, currentUser)
    {
        return NotesService.genericCreator('case', case_, note, currentUser);
    }

    // function for updating notes
    static async updateNote(noteGuid, notePayload)
    {
        // creating payload to update
        const note =
        {
            title: (notePayload.title || null),
            body: notePayload.body,
            type: notePayload.type,
            isDeleted: false
        };

        // find note by note GUID and patch the note and return job/order guid
        const updatedNote = await Notes.query()
            .patchAndFetchById(noteGuid, note)
            .withGraphFetched('[job, order, createdBy]');

        // not doesn't exist
        if (updatedNote == undefined)
            throw new NotFoundError('Note does not exist');

        const { parentGuid, parentName } = NotesService.buildPubSubPayload(updatedNote);

        // update pubsub accordingly
        await PubSubService.publishNote(parentGuid, parentName, updatedNote, 'updated');
    }

    // function to delete note
    static async deleteNote(noteGuid)
    {
        // find note being that needs to be deleted return job/order guid
        const updatedNote = await Notes.query()
            .patchAndFetchById(noteGuid, { isDeleted: true })
            .withGraphFetched('[job, order, createdBy]');

        // not doesn't exist
        if (!updatedNote)
            throw new NotFoundError('Note does not exist');

        const { parentGuid, parentName } = NotesService.buildPubSubPayload(updatedNote);

        // update pubsub accordingly
        await PubSubService.publishNote(parentGuid, parentName, updatedNote, 'deleted');
    }

    /**
     * @description creates a note attached to a parent model.
     *
     * @param {String} name
     * @param {Order | OrderJob | Case} model
     * @param {Notes} note
     * @param {String | User} currentUser
     * @returns {Notes}
     */
    static async genericCreator(name, model, note, currentUser)
    {

        // adding current user
        note.setCreatedBy(currentUser);

        // linking models to propper parent table
        note.graphLink(name, model);

        const createdNote = await Notes.query()
            .insertGraphAndFetch(note, { allowRefs: true, relate: true })
            .withGraphFetched('createdBy');

        // dont return the parent data that the note was attached to.
        delete createdNote[name];

        // update pubsub accordingly
        await PubSubService.publishNote(model.guid, name, createdNote, 'created');

        return createdNote;
    }

    static async getOrderNotes(orderGuid)
    {
        // find all notes for order, (using extra join to know if order exists)
        const notes = await Order.relatedQuery('notes')
            .for(orderGuid)
            .withGraphJoined('createdBy')
            .orderBy('dateCreated', 'desc');

        return notes;
    }

    static async getJobNotes(jobGuid, queryParams)
    {
        const { type, pg: page, rc: rowCount, order } = queryParams;

        const notesQueryBuilder = Notes.query().withGraphFetched('createdBy').alias('gn')
            .select(raw('gn.*, false as "isClientNote"'))
            .leftJoin('orderJobNotes', 'gn.guid', 'orderJobNotes.noteGuid')
            .where('orderJobNotes.jobGuid', jobGuid);

        // filter between job notes types
        if (type)
            notesQueryBuilder.where('gn.type', type);

        // get order notes (which are client notes actually ;))
        if (order)
            notesQueryBuilder.union(
                Notes.query().withGraphFetched('createdBy').alias('gn2')
                    .select(raw('gn2.*, true as "isClientNote"'))
                    .leftJoin('orderNotes', 'gn2.guid', 'orderNotes.noteGuid')
                    .rightJoin('orderJobs', 'orderNotes.orderGuid', 'orderJobs.orderGuid')
                    .where('orderJobs.guid', jobGuid)
                    .whereNotNull('gn2.guid')
            );

        const { results, total } = await notesQueryBuilder.orderBy('dateCreated', 'desc')
            .page(page, rowCount);

        return {
            results,
            page: page + 1,
            rowCount,
            total
        };
    }

    // get all notes for an order
    static async getAllNotes(orderGuid)
    {
        // find all notes for order and jobs, (using extra join to know if order exists)
        const order = await Order.query().findById(orderGuid).withGraphJoined('[notes(notDeleted).[createdBy], jobs.[notes(notDeleted).[createdBy]]]').orderBy('jobs:notes:dateCreated', 'desc');

        if (!order)
            return null;

        const jobNotes = {};
        for (const job of order.jobs)
            jobNotes[job.guid] = job.notes;

        // return notes
        return {
            'order': order.notes,
            'jobs': jobNotes
        };
    }

    static buildPubSubPayload(note)
    {
        // assigning guid
        let parentGuid;
        let parentName;

        if (note.job)
        {
            parentGuid = note.job.guid;
            parentName = 'job';
        }
        else
        {
            parentGuid = note.order.guid;
            parentName = 'order';
        }

        delete note.order;
        delete note.job;

        return { parentGuid, parentName };
    }
}

module.exports = NotesService;