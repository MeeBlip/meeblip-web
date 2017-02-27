// access to port and channel select boxes and underlying midi object for accessing ports, sending messages, etc.

var midi = {

  selectedChannel: function() {
    var form = document.forms["editor"];
    var channelOpt = form.elements["channel"][form.elements["channel"].selectedIndex].value - 1;
    return parseInt(channelOpt);
  },
  
  selectedPort: function() {
    var form = document.forms["editor"];
    return form.elements["port"][form.elements["port"].selectedIndex].value;        
  },

  isSelectedPortValid: function() {
    var selectedPort = this.selectedPort();
    
    if (typeof this.outputs[selectedPort] == "undefined") {
      alert("sorry. \"" + selectedPort + "\" isn't a valid MIDI port.");
      return false;
    } else {
      return true;
    }
  },

  getOutputPort: function() {
    var out = {};
    if (this.isSelectedPortValid()) {
      out = this.outputs[this.selectedPort()];
    }
    return out;
  },

  onMIDISuccess: function(midiAccess) {
      console.log('MIDI Access Object', midiAccess);
      //console.log(this);

      var self = this;
      midiAccess.onstatechange = function(e) {
          self.onMIDIAccessChange(e);
      }
      this.midiAccess = midiAccess;
      this.inputs = {};
      this.outputs = {};

      this.initPorts();
  },

  initPorts: function() {    

      var self = this;

      var inputs = this.midiAccess.inputs;
      if (inputs.size > 0) {
          inputs.forEach(
              function(port, key) {
                  //console.log(port);
                  self.registerPort(port);
              }
          );
      }

      var outputs = this.midiAccess.outputs;
      if (outputs.size > 0) {
          outputs.forEach(
              function(port, key) {
                  self.registerPort(port);        
                  self.renderPort(port);
              }
          );
          // select port from history state (if any) after port options rendered
          this.editor.mapStateToSelectBoxes();
      }
  },

  onMIDIAccessChange: function(e) {
      console.log("MIDI access change: " + e);
      //console.log(this);
      var port = e.port;

      if (port.type == "input") {
          if (this.inputs[port.name] === undefined) {
              this.registerPort(port);
          }
      } else {
          if (this.outputs[port.name] === undefined) {
              this.registerPort(port);
          }
          this.renderPort(port);
      }
  },

  renderPort: function(port) {
      var portOptions = $("#port").children();

      if (port.state == "connected") {
          if ((portOptions.length == 1) && (portOptions.get(0).value == "none")) {
              $("#port").empty();
          }

          if (!$("#" + port.type + port.id).length) {
              var html = '<option id="' + port.type + port.id + '" value="' + port.name + '">' + port.name + '</option>';
              $("#port").append(html);
          }
      } else {
          $("#" + port.type + port.id).remove();

          if ($("#port").children().length == 0) {
              $("#port").append('<option value="none">ports</option>')
          }
      }
  },

  registerPort: function(port) {
      var self = this;
      if (port.type == "input") {
          this.inputs[port.name] = port;
          port.onmidimessage = function(m) { self.onMIDIMessage(m); };
      } else {
          this.outputs[port.name] = port;
      }

      port.onstatechange = function(e) { self.onPortStateChange(e); };
  },

  onMIDIFailure: function(e) {
      // when we get a failed response, run this code
      alert("No access to MIDI devices or your browser doesn't support WebMIDI API. Please use WebMIDIAPIShim " + e);
  },

  onPortStateChange: function(event) {
    console.log("port state change: " + event);
  },

  onMIDIMessage: function(message) {
      //console.log(message);
  },

  requestMidiAccess: function(editor) {
    this.editor = editor;
    var self = this;
    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess({
            sysex: true
        }).then(
            function(midiAccess) { self.onMIDISuccess(midiAccess) }, function(e) { self.onMIDIFailure(e); }
        );

    } else {
        alert("No MIDI support in your browser.");
    }    
  }

};
