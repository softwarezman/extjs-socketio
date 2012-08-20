Ext.define('Ext.ux.SocketIO', {
	extend: 'Ext.util.Observable',
    owner: null,
    
    /**
     * An empty function by default, but provided so that you can perform custom
     * record validations before they are added to the store
     * @param {String} Type of event that is calling the function (update, add, remove)
     * @param {Ext.data.Model} The model that needs to be validated
     * @method validateRecords
     */
    validateRecords: Ext.emptyFn,
    
    /**
     * What the connection should do if the validation fails.
     * Defaults to '' which means it leaves the record alone.
     * Other supported option is 'remove' which will remove the record completely from the store
     */
    validationFailureAction: '',
    
    constructor: function(config){
    	var me = this;
		//See if this can be swapped from Ext.ux.SocketIO to 'this'
        me.superclass.constructor.call(
            this
        );
        
        me.validateRecords = config.validateRecords || me.validateRecords;
        me.validationFailureAction = config.validationFailureAction || me.validationFailureAction;
        
        me.socket = io.connect(config.host, {
			port: config.port,
			reconnect: config.reconnect,
			'reconnection delay': config['reconnection delay'],
			'max reconnection attempts': config['max reconnection attemps'],
			'transports': ['websocket','flashsocket','htmlfile','xhr-multipart', 'xhr-polling']
		});
        
        me.socket.on('connect', function() {
        	me.fireEvent('socketconnect', me, this, arguments);
        });
        
        me.socket.on('disconnect', function() {
        	me.fireEvent('socketdisconnect', me, this, arguments);
        });
				
        me.socket.on('server-doInitialLoad', function(data){
            me.onInitialLoad(data);
        });
        me.socket.on('server-doUpdate', function(data){
            me.onUpdate(data);
        });
        me.socket.on('server-doAdd', function(data){
            me.onAdd(data);
        });
        me.socket.on('server-syncId', function(data){
            me.syncId(data);
        });
        me.socket.on('server-doRemove', function(data){
            me.onRemove(data);
        });                                
    },
    
    initComponent: function() {
    	var me = this;
    	me.addEvents(
    		/**
    		 * @event socketconnect
    		 * Fires when the component has connected the backend server
    		 * @param {Socket.IO} This
    		 * @param {Event} connect event details
    		 * @param {Object} Arguments passed to the connect string
    		 */
    		'socketconnect', 
    		/**
    		 * @event socketdisconnect
    		 * Fires when the component has been disconnected from the backend server
    		 * @param {Socket.IO} This
    		 * @param {Event} connect event details
    		 * @param {Object} Arguments passed to the connect string
    		 */
    		'socketdisconnect');
    	
    	me.callParent();
    },

    /** 
    * On adding records to client store, send event to server and add items to DB.
    */
    doAdd: function(store, operation, opts){
		if(operation.action === 'create') {
	        var recordsData = [],
			records = operation.getRecords();

	        if(records.length){
	            for(var i=0, l=records.length; i<l; i+=1){
	                recordsData.push({
	                    data: records[i].data,
	                    internalId: records[i].internalId
	                });
	            }
	        } else{
	            recordsData.push({
	                data: records.data,
	                internalId: records.interalId
	            });
	        }
			
	        this.socket.emit('client-doAdd', {records: recordsData, storeType: opts.storeType});	
		} 		
    },

    /** 
    * On adding records to DB event is received and records are added to the client store
    */
    onAdd: function(data){
        var storeType = data.storeType,
            data      = data.records,
            record,
			records = [],
			view = this.owner.getView(),
			fAct = this.validationFailureAction,
            current;                    
		
		if(this.getStoreByType(storeType)) {
			store     = this.getStoreByType(storeType),
			modelIdProperty = new store.model().idProperty;				
		} else {
			return
		}
		
		
        store.suspendEvents();
		store.suspendAutoSync();
		
	    for(var i=0, l=data.length; i<l; i+=1){
            current = data[i].data;
			
			record = store.getById(current[modelIdProperty]);
			if(!record) {
				//delete internalId property from the data as it's not needed
	            delete current.internalId;
				
				record = new store.model(current);
				
				if(this.validateRecords('update', record) !== false) {
					records.push(record);
		            store.insert(0, record);
				} //We don't do anything if they fail since it just won't add the record
			}
        }

        //resume events => refreshing views
		store.resumeAutoSync();
        store.resumeEvents();
        
        this.refreshView(view);
        
		if(records.length > 0) {
			store.fireEvent('socketAdd', store, records, arguments);
			
			this.applyEffect(records);
		}
    },
	
	/** 
    * On adding records to DB, sync event is received with records assigned ID's. Data should be synced
    * with client store.
    */
    syncId: function(data){
        var storeType = data.storeType,
            data      = data.data,
            store     = this.getStoreByType(storeType),
            records   = store.getRange();

        for(var i=0, l=data.length; i<l; i+=1){
            current = data[i];
            internalId = current.internalId;
            delete current.internalId;
            
            Ext.Array.each(records, function(rec, idx){
                if(rec.internalId == internalId){
                    rec.set('Id', current.Id);
                    return false;
                }
            });
        }                                   
    },

    /** 
    * On updating records in client store, send event to server and update items in DB.
    */
    doUpdate: function(store, records, type, changes, opts){
		if(type === 'commit') {
			var recordsData = [];

	        if(records.length){
	            for(var i=0, l=records.length; i<l; i+=1){
	                recordsData.push({
	                    data: records[i].data
	                });
	            }
	        } else{
	            recordsData.push({
	                data: records.data
	            });
	        }
	        this.socket.emit('client-doUpdate', {records: recordsData, storeType: opts.storeType});
		}
	},

    /** 
    * On updating records in DB event is received and data in client store is updated.
    */
    onUpdate: function(data){
        var storeType = data.storeType,
            data      = data.records,
            record,
			records = [],
            current,
            fAct = this.validationFailureAction,
			store, modelIdProperty;            
		
		if(this.getStoreByType(storeType)) {
			store     = this.getStoreByType(storeType),
			modelIdProperty = new store.model().idProperty;				
		} else {
			return
		}
		
		
		
        store.suspendEvents();
		store.suspendAutoSync();
		
        for(var i=0, l=data.length; i<l; i+=1){
            current = data[i].data;
			
            record = store.getById(current[modelIdProperty]);
            if (record) {
                current.startDate && (current.StartDate = new Date(current.StartDate));
                current.endDate && (current.endDate   = new Date(current.EndDate));
            	
                if(this.validateRecords('update', Ext.create(record.modelName, current)) !== false) {
                	record.set(current);
                	/**
    				 * If you don't set dirty = false it will try and submit
    				 * an update with this record the next time you update any other record 
    				 */
    				record.dirty = false;
    				records.push(record);
                } else {
					if(fAct === 'remove') {
						store.remove(record);
					}
				}
            }
        }

		
        store.resumeAutoSync();
        store.resumeEvents();
        
        this.refreshView();
        
		if(records.length > 0) {
			store.fireEvent('socketUpdate', store, records, arguments);
			this.applyEffect(records);
		} 
    },

    /** 
    * On adding removing records from client store, send event to server and remove items from DB.
    */
    doRemove: function(store, records, index, opts){
        var recordsData = [],
		modelIdProperty = new store.model().idProperty;

        if(records.length){
            for(var i=0, l=records.length; i<l; i+=1){
                recordsData.push({
                    data: records[i].get(modelIdProperty)
                });
            }
        } else{
            recordsData.push({
                data: records.get(modelIdProperty)
            });
        }

        this.socket.emit('client-doRemove', {records: recordsData, storeType: opts.storeType});                
    },

    /** 
    * On removing records from DB event is received and elements are deleted from client store.
    * 
    */
    onRemove: function(data){
        var storeType = data.storeType,
            data      = data.records,
            record,
			records = [],
            current; 
		
		if(this.getStoreByType(storeType)) {
			store     = this.getStoreByType(storeType),
			modelIdProperty = new store.model().idProperty;				
		} else {
			return
		}
		
        store.suspendEvents();
		store.suspendAutoSync();
		
        for(var i=0, l=data.length; i<l; i+=1){
            current = data[i].data;
            record = store.getById(current);
            
            if(this.validateRecords('update', record) !== false) {
            	store.remove(record);
    			records.push(record);
            } //We don't have to do anything else since they didn't update any data but just tried to delete it
        }
        
        store.resumeAutoSync();
        store.resumeEvents();
        
        this.refreshView();
        
        /**
		 * Clear out the removed records as they have already been deleted by the
		 * original client
		 */
        if(records.length > 0) {
        	store.removed = [];
        	store.fireEvent('socketRemove', store, records, arguments);
        }
		//this.applyEffect(records);
    },

    /** 
    * On loading data from DB event is received, and data is loaded to client store.
    */
    onInitialLoad: function(data){
        var storeType = data.storeType,
            data      = data.data,
            store     = this.getStoreByType(storeType);

        store.loadData(data);
    },
	
	/** 
    * Emit event to server in order to receive initial data for store from the DB.
    */
    doInitialLoad: function(storeType){
        this.socket.emit('client-doInitialLoad', {storeType: storeType});
    },
	
	/**
	 * Custom function to refresh views for outlyer situations where the 
	 * view may need a different function to be called
	 * @param {Ext.grid.View} view The grid's parent view
	 */
	refreshView: function() {
		var view = this.owner.getView();
		
		view.refreshKeepingScroll ? view.refreshKeepingScroll() : view.refresh();		
	},
	
	/**
	 * Applys a visual effect to the records so users who receive updates
	 * can see that they have changed/been added
	 * @param {Ext.data.Model[]} records
	 */
	applyEffect: function(records) {
		var view = this.owner.getView(), 
			node;
		
		for(var i=0; i<records.length; i++) {
			//Added support for Bryntum Scheduler's getElementFromEventRecord.
			node = view.getNode(records[i]) ? view.getNode(records[i]) : view.getElementFromEventRecord(records[i]);
			if(node) {
				Ext.fly(node).highlight("aa0000",{
					attr: 'color', duration: 5000
				});	
			}			
		}
	},

    

    /** 
    * Select either Resource or Event store
    */
    getStoreByType: function(storeType){
		if(storeType == this.owner.getStore().storeId || storeType.storeId == this.owner.getStore().storeId) {
			return this.owner.getStore();
		} else {
			return this.owner[storeType.storeProperty];
		}
		
    }
});