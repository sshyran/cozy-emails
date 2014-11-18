AppDispatcher = require '../app_dispatcher'
{ActionTypes} = require '../constants/app_constants'
XHRUtils      = require '../utils/xhr_utils'
AccountStore  = require "../stores/account_store"
MessageStore  = require '../stores/message_store'
LayoutActionCreator = require './layout_action_creator'

module.exports =

    receiveRawMessages: (messages) ->
        AppDispatcher.handleViewAction
            type: ActionTypes.RECEIVE_RAW_MESSAGES
            value: messages

    receiveRawMessage: (message) ->
        AppDispatcher.handleViewAction
            type: ActionTypes.RECEIVE_RAW_MESSAGE
            value: message

    send: (message, callback) ->
        XHRUtils.messageSend message, (error, message) ->
            if not error?
                AppDispatcher.handleViewAction
                    type: ActionTypes.MESSAGE_SEND
                    value: message
            if callback?
                callback error, message

    delete: (message, callback) ->
        # Move message to Trash folder
        account = AccountStore.getByID(message.get 'accountID')
        if not account?
            console.log "No account with id #{message.get 'accountID'} for message #{message.get 'id'}"
            LayoutActionCreator.alertError t 'app error'
            return
        trash = account.get 'trashMailbox'
        if not trash?
            LayoutActionCreator.alertError t 'message delete no trash'
        else
            msg = message.toJSON()
            AppDispatcher.handleViewAction
                type: ActionTypes.MESSAGE_ACTION
                value:
                    id: message.get 'id'
                    from: Object.keys(msg.mailboxIDs)
                    to: trash
            observer = jsonpatch.observe msg
            delete msg.mailboxIDs[id] for id of msg.mailboxIDs
            msg.mailboxIDs[trash] = -1
            patches = jsonpatch.generate observer
            XHRUtils.messagePatch message.get('id'), patches, (err, message) ->
                if not err?
                    AppDispatcher.handleViewAction
                        type: ActionTypes.MESSAGE_DELETE
                        value: message
                if callback?
                    callback err

    move: (message, from, to, callback) ->
        if typeof message is "string"
            message = MessageStore.getByID message
        msg = message.toJSON()
        AppDispatcher.handleViewAction
            type: ActionTypes.MESSAGE_ACTION
            value:
                id: message.get 'id'
                from: from
                to: to
        observer = jsonpatch.observe msg
        delete msg.mailboxIDs[from]
        msg.mailboxIDs[to] = -1
        patches = jsonpatch.generate observer
        XHRUtils.messagePatch message.get('id'), patches, (error, message) ->
            if not error?
                AppDispatcher.handleViewAction
                    type: ActionTypes.RECEIVE_RAW_MESSAGE
                    value: message
            if callback?
                callback error

    undelete: ->
        action = MessageStore.getPrevAction()
        if action?
            message = MessageStore.getByID action.id
            @move message, action.to, action.from
        else
            LayoutActionCreator.alertError t 'message delete no trash'

    updateFlag: (message, flags, callback) ->
        msg = message.toJSON()
        patches = jsonpatch.compare {flags: msg.flags}, {flags}
        XHRUtils.messagePatch message.get('id'), patches, (error, message) ->
            if not error?
                AppDispatcher.handleViewAction
                    type: ActionTypes.RECEIVE_RAW_MESSAGE
                    value: message
            if callback?
                callback error
