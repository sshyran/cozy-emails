AppDispatcher = require '../app_dispatcher'
{ActionTypes} = require '../constants/app_constants'
Activity      = require '../utils/activity_utils'
LayoutActionCreator = require '../actions/layout_action_creator'

module.exports = ContactActionCreator =

    searchContact: (query) ->
        options =
            name: 'search'
            data:
                type: 'contact'
                query: query

        activity = new Activity options
        activity.onsuccess = ->
            AppDispatcher.handleViewAction
                type: ActionTypes.RECEIVE_RAW_CONTACT_RESULTS
                value: @result
        activity.onerror = ->
            console.log "KO", @error, @name

    createContact: (contact) ->
        options =
            name: 'create'
            data:
                type: 'contact'
                contact: contact

        activity = new Activity options
        activity.onsuccess = ->
            AppDispatcher.handleViewAction
                type: ActionTypes.RECEIVE_RAW_CONTACT_RESULTS
                value: @result
            msg = t('contact create success', {contact: @result[0].fn})
            LayoutActionCreator.notify msg, autoclose: true
        activity.onerror = ->
            msg = t('contact create error', {error: @name})
            LayoutActionCreator.notify msg, autoclose: true
