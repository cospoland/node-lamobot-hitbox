'use strict'
const logger = require('node-logger')
const WebSocketClient = require('websocket').client
const ChatServerClass = require('./ChatServer.js')

class Chat {
  constructor (ChatServer, Handler) {
    this.WebsocketClient = null
    this.Connection = null
    this.ChatServer = ChatServer
    this.Handler = Handler
    this.Data = null // store here everything else that may be required by handler

    if (this.ChatServer.PlainAddress == null) {
      /*
        Recreate ChatServer object.
        However, you should create ChatServer object before you construct Chat.
        This may cause delay.
      */
      logger.warn('The server address not found. Recreating ChatServer object.')
      this.ChatServer = new ChatServerClass(() => {
        this.Handler('!_READY', null, this)
      }, true)
    } else if (this.ChatServer.WebsocketID == null) {
      // Get websocket ID if it's null. However, this may delay READY event.
      logger.warn('Websocket ID should be found before you initialize Chat object.')
      this.ChatServer.GetWebsocketID(() => {
        this.Handler('!_READY', null, this)
      })
    } else {
      this.Handler('!_READY', null, this)
    }
  }

  /*
    Creates a websocket connection to the chat server.
  */
  Connect () {
    this.WebsocketClient = new WebSocketClient()
    this.WebsocketClient.on('connectFailed', (error) => {
      return this.Handler('!_FAILED', error, this)
    })
    this.WebsocketClient.on('connect', (connection) => {
      this.Connection = connection
      this.Handler('!_CONNECTED', null, this)
      this.Connection.on('error', (error) => {
        return this.Handler('!_INTERRUPT', error, this)
      })
      this.Connection.on('close', () => {
        this.Handler('!_CLOSED', null, this)
      })
      this.Connection.on('message', (message) => {
        if (message.type === 'utf8') {
          if (message.utf8Data === '2::') {
            /*
              Handle ping. Extra event is sent to the Handler but the ping is sent automatically
              so it does not need to be handled.
            */
            this.Connection.sendUTF('2::')
            this.Handler('Ping', null, this)
          } else if (message.utf8Data === '1::') {
            /*
              Forward event sent when connected successfuly.
            */
            this.Handler('Connected', null, this)
          } else if (message.utf8Data === '7:::1+0') {
            /*
              Websocket ID is wrong.
            */
            this.Handler('WrongWebsocketID', null, this)
          } else if (message.utf8Data.startsWith('5:::')) {
            /*
              Forward chat event sent when for example someone sent a message,
              subscribed, has been banned, left or sent a whisper.
            */
            this.Handler('Message', JSON.parse(message.utf8Data), this)
          } else {
            /*
              Forward unknown message.
            */
            this.Handler('Unknown', message.utf8Data, this)
          }
        }
      })
    })
    this.WebsocketClient.connect('ws://' + this.ChatServer.PlainAddress + '/socket.io/1/websocket/' + this.ChatServer.WebsocketID, 'chat')
  }

  /*
    Sends a JSON to the server.
  */
  Send (Json) {
    this.Connection.sendUTF('5:::' + JSON.stringify({name: 'message', args: Json}))
  }
  
  /*
    Join channel 
  */
  JoinChannel (Channel, Username, Token, NoBacklog = true) {
    this.Token = Token
    this.Username = Username
    this.Channel = Channel
    this.Send({
      method: 'joinChannel',
      params: {
        channel: Channel,
        name: Username,
        token: Token,
        hideBuffered: NoBacklog
      }
    })
  }
  
  /*
    Leave channel (logout)
  */
  Leave (Username) {
    this.Send({
      method: 'partChannel',
      params: {
        channel: Channel,
        name: Username,
        token: Token,
        hideBuffered: NoBacklog
      }
    })
    this.Connection.close()
  }
  
  SendMessage (Path, Callback) {}
  SendMeMessage (Path, Callback) {}
  SendWhisper (Path, Callback) {}
  IfWhisper (Message, MessageCallback, WhisperCallback) {}
}

module.exports = Chat