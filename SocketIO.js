Ext.define('Ext.ux.SocketIO', {
	extend: 'Ext.util.Observable',
    owner: null,

    constructor: function(config){
		//See if this can be swapped from Ext.ux.SocketIO to 'this'
        Ext.ux.SocketIO.superclass.constructor.call(
            this
        );

        this.socket = io.connect(config.host, {
			port: config.port
		});
		
		/*this.socket.on('connect', function() {
			console.log('Connected to Socket.io server');
		});
		
		this.socket.on('disconnect', function() {
			console.log('Disconnected from Socket.io server');
		});*/
		
        var that = this;

        this.socket.on('server-doInitialLoad', function(data){
            that.onInitialLoad(data);
        });
        this.socket.on('server-doUpdate', function(data){
            that.onUpdate(data);
        });
        this.socket.on('server-doAdd', function(data){
            that.onAdd(data);
        });
        this.socket.on('server-syncId', function(data){
            that.syncId(data);
        });
        this.socket.on('server-doRemove', function(data){
            that.onRemove(data);
        });                                
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
				//console.log(record);
				
				records.push(record);
	            //change dates from JSON form to Date
	            //current.startDate = new Date(current.StartDate);
	            //current.endDate   = new Date(current.EndDate);
	            
	            store.insert(0, record);	
			}
                                            
        }

        //resume events => refreshing views
		store.resumeAutoSync();
        store.resumeEvents();
		
		store.fireEvent('socketAdd', store, records, arguments);
		
        //this.owner.getView().refreshKeepingScroll();
		this.refreshView(view);
		this.applyEffect(records);
		
		
		
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
			node,
            current,
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
                //current.startDate && (current.StartDate = new Date(current.StartDate));
                //current.endDate && (current.endDate   = new Date(current.EndDate));
                record.set(current);

				/**
				 * If you don't set dirty = false it will try and submit
				 * an update with this record the next time you update any other record 
				 */
				record.dirty = false;
				records.push(record);            
            }
        }

		store.resumeAutoSync();
        store.resumeEvents();
		
		store.fireEvent('socketUpdate', store, records, arguments);
		
		this.refreshView();
		this.applyEffect(records);
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
			
            store.remove(record);
			
			records.push(record);
			/**
			 * Clear out the removed records as they have already been deleted by the
			 * original client
			 */          
			store.removed = [];
        }
		
		store.resumeAutoSync();
        store.resumeEvents();
		store.fireEvent('socketRemove', store, records, arguments);
		this.refreshView();
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