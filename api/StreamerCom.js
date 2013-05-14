var fs               = require('fs'),
    util             = require('util'),
    events           = require('events'),
    moment           = require('moment');


function StreamerCom() {

    events.EventEmitter.call (this);

//    StreamerCom.super_.call(this);
    var self = this;

    //this.name = "StreamerCom";
    /*  mode can be PUSH mode or SAVE mode
    *   PUSH mode: dataBuffer is an array of received datas
    *   SAVE mode: dataBuffer is the last data received
    */
    this.mode = "SAVE";
    this.rec_count = 0;
    this.rej_count = 0;
    this.ret_count = 0;

    /*user data received*/
    this.dataBuffer = undefined;

    /*user data requesters*/
    this.requestBuffer = [];

    /*if receiving enabled : StreamerCom is open to receive data and save it to buffer. */
    this.receiving = false;

    this.dataupdated = false;
    this.dataupdated_source = "";
}

util.inherits( StreamerCom, events.EventEmitter );

/* Source Object : another StreamerCom*/
/* Destination Object : another StreamerCom*/

//this.source_object = stream_source_object;
//this.destination_object = stream_destination_object;

StreamerCom.prototype.PushData = function(data) {
    if (this.dataBuffer===undefined) this.dataBuffer = [];
    this.dataBuffer.push(data);
    return (this.dataBuffer);
}

StreamerCom.prototype.SaveData = function(data) {
    this.dataBuffer = data;
    return true;
}

StreamerCom.prototype.DataReceived = function() {
    return (this.dataBuffer!==undefined);
}

StreamerCom.prototype.DataUpdated = function() {
    return (this.dataupdated);
}

StreamerCom.prototype.DataUpdatedUpstream = function() {
    return (this.dataupdated && (this.dataupdated_source!=this.name));
}


StreamerCom.prototype.DataUpdatedReset = function() {
    this.dataupdated = false;
    this.dataupdated_source = "";
}

StreamerCom.prototype.PopData = function() {
    return RetreiveData();
}

StreamerCom.prototype.ReceiveData = function(data) {

    if (data===undefined) {
        console.log('mbc-mosto: [INFO] [StreamerCom] ReceiveData: data undefined!');
        this.rej_count++;
        this.emit('datarejected', undefined );
        return false;
    }

    if (this.receiving) {
        console.log('mbc-mosto: [INFO] [StreamerCom]  ['+this.name+'] receiving data mode: ' + this.mode);
        if (this.mode=="PUSH") {
            this.PushData(data);
        } else if (this.mode=="SAVE" || 1==1) {
            this.SaveData(data);
        }
        console.log('mbc-mosto: [INFO] [StreamerCom]  ['+this.name+'] receiving data ok, emit datareceived: ' + this.ReadData());
        this.rec_count++;
        this.emit('datareceived', data );
        this.emit('dataupdated', this.name );
        this.dataupdated = true;
        this.dataupdated_source = this.name;
        return true;
    } else {
        this.rej_count++;
        this.emit('datarejected', data );
        return false;
    }
}

/**
*   RetreiveData : reset buffers.
*/
StreamerCom.prototype.RetreiveData = function( self ) {
    var self = this;
    var datatemp = undefined;

    if (self.mode=="SAVE") {
        datatemp = self.dataBuffer;
        console.log("mbc-mosto: [INFO] [StreamerCom] RetreiveData: " + datatemp);
        self.dataBuffer = undefined;//empty, retreival
        console.log("mbc-mosto: [INFO] [StreamerCom] RetreiveData: "+datatemp);
    } else if (self.mode=="PUSH") {
        datatemp = self.dataBuffer.shift();
    }

    self.ret_count++;

    return datatemp;
}

/**
*   ReadData : read the buffer.
*/
StreamerCom.prototype.ReadData = function() {
    return this.dataBuffer;
}

StreamerCom.prototype.IsReceiving = function() {
    return this.Receiving();
}

StreamerCom.prototype.Receiving = function() {
    return (this.receiving);
}

StreamerCom.prototype.Open = function( mself ) {
    this.receiving = true;
    return (this.receiving);
}

StreamerCom.prototype.Close = function() {
    this.receiving = false;
    this.dataBuffer = undefined;
    return (this.receiving);
}

StreamerCom.prototype.ReceiveRequest = function(listener) {
    this.requestBuffer.push(listener);
}

StreamerCom.prototype.ProcessRequest = function(listeners) {
    if (this.DataReceived()) {
        var new_requestBuffer = [];
        for(var i=0; i<this.requestBuffer.length;i++) {
            var listener = this.requestBuffer[i];
            if (listener) {
                //TODO: check if it's an EventListener and if we have data
                listener.emit('datarequestresponse', 'dataready' );
                this.requestBuffer[i] = undefined;
            } else new_requestBuffer.push(listener);
        }
        this.requestBuffer = new_requestBuffer;
    }
}

StreamerCom.prototype.ResetListeners = function( mself ) {
    var self = mself || this;
/*
    self.name = "StreamerCom";
    self.receiving = true;
    self.dataBuffer = undefined;
    self.mode = "SAVE";
    self.rec_count = 0;
    self.rej_count = 0;
    self.ret_count = 0;
    self.requestBuffer = [];
*/
    self.removeAllListeners();
    self.on('datasend', function(data) {
        console.log('mbc-mosto: [INFO] [StreamerCom] ['+self.name+'] datasend received, receiving data...: ' + data + " receiving:" + self.receiving + " DataReceived:" + self.DataReceived() );

        if (self.ReceiveData(data)) {
            console.log('mbc-mosto: [INFO] [StreamerCom] ['+self.name+'] received data OK!');
            console.log( self.ReadData() );
        } else console.log('mbc-mosto: [INFO] [StreamerCom] ['+self.name+'] data rejected!');
    });
    self.on( 'dataupdated' , function(streamer) {
        self.dataupdated = true;
        self.dataupdated_source = streamer;
    });
    self.on('datarequest', function(requester) {
        self.ReceiveRequest(requester);
        self.ProcessRequests();
    });
}

exports = module.exports = function() {
    var streamercom = new StreamerCom();
    return streamercom;
};
