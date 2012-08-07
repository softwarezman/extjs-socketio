#extjs-socketio ExtJS 4.1 Socket.io support#

ExtJS 4 Socket.io support code to allow additional plugins to interact with the Socket.io client JavaScript package

Originally based on examples provided by Bryntum's Scheduler blog: http://bryntum.com/blog/nodejs-ext-scheduler-realtime-updates/

##How it works##

*Listens for socket.io messages (currently defined as: server-doInitialLoad, server-doUpdate, server-doAdd, server-syncId, server-doRemove) at which point it will process the incoming data based on the event to add records, remove records, or update records. It also has a 'highlight' function that can be overridden to allow for notifying connected users that something on the grid has changed. 
*It allows for the parent plugin (currently the GridSocketIO plugin located at: https://github.com/softwarezman/extjs-socketio-gridplugin) to call it's internal add/remove/update functions in which it will post all added/removed/updated records to the node.js (or whatever socket.io compatible backend you may be using) for processing (if necessary) and pushing back out. 
*It does require the backend to emit a message with the previously defined names or else it won't know what to listen to. This could probably be extended to allow for configuration changes.

##How to use##

*Just include it with the GridSocketIO.js file wherever you stick your Ext.ux. files and you should be good to go (the GridSocketIO.js file has a require statement that links up to this Socket.io file. 
*This has only been tested on my one application and is subject to massive tweaking if something goes crazy.