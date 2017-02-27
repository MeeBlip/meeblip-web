var sequencer = {
  playerId: null,
  
  stop: function() {
    if (this.playerId != null) {
      
      window.clearInterval(this.playerId);
      
      for (var i = 0; i < 8; i++) {
        $("#stepTie" + i ).css("border-top", "0px solid #fff");
      }
      var channel = midi.selectedChannel();
      var off = 128 + channel;
      var midiOut = midi.getOutputPort();
      for (var i = 0; i < 128; i++) {
        midiOut.send([off, i, 0]);
      }
    
    }
  },

  play: function() {
    if (!midi.isSelectedPortValid()) {
      return false;
    }

    if (sequencer.playerId != null) {
      this.stop();
    }
    var bpm = $("#bpm").val();

    var bps = 1 / (bpm / 60);
    //console.log("bps: " + bps);

    var delay = (bps * 1000) / 2;
    //console.log("interval: " + delay);
    
    var idx = 0;

    var self = this;
    sequencer.playerId = window.setInterval(
      function() {
        var step = idx++ % 8;
        var prev = step - 1;
        if (prev < 0) {
          prev = 7;
        }
        self.handleStepChange(step, prev); 
      },
      delay
    );
  },

  handleStepChange: function(step, prev) {
    //console.log("current=" + step + ", prev=" + prev);
    var f = document.forms["sequencer"];
    
    var channel = midi.selectedChannel();
    var on = 144 + channel;
    var off = 128 + channel;
    var midiOut = midi.getOutputPort();

    $("#stepTie" + step ).css("border-top", "6px solid #999");
    $("#stepTie" + prev ).css("border-top", "0px solid #fff");

    var prevNote = f.elements["stepNote" + prev].value;
    var curNote = f.elements["stepNote" + step].value;
    var velocity = f.elements["stepVelo" + step].value;
    //console.log("current note: " + curNote + ", prev note: " + prevNote);
    midiOut.send([off, prevNote, 0]);      
    var numPlaying = this.playingNotes[prev].length;
    if (numPlaying > 1) {
      //console.log(this.playingNotes[prev]);
    }
    for (var i = 0; i < numPlaying; i++) {
      midiOut.send([off, this.playingNotes[prev].pop(), 0]);
    }
    if (curNote > 35) { // start at 36, c1
      this.playingNotes[step].push(curNote);
      //console.log(this.playingNotes[step]);
      midiOut.send([on, curNote, velocity]);
    }
  },

  playingNotes: [
    [], [], [], [], [], [], [], []
  ],

  // TODO: write a Step object to make it easy to interact with steps in the sequencer
  loadTemplate: function(seqPanel) {
    $("#seq").button().click(
      function(event) {

        $(seqPanel).dialog({
          closeOnEscape: true,
          width: 680,
          dialogClass: "dialogHeader",
          height: 440,
          modal: true,
          position: { my: "center top", at: "left bottom", of: $("#seq") }
        });
        return false;
      }
    );

    // data structure for displaying notes table
    var noteNames = [
      " c","c#"," d","d#"," e"," f","f#"," g","g#"," a","a#"," b"
    ];

    var noteNumbersToNames = {
      rows: []
    }
    var noteNames = [
      "c","c#","d","d#","e","f","f#","g","g#","a","a#","b"
    ];
    for (var i = 36; i < 128; i++) {
      var noteIdx = i % 12;
      var octave = (i - noteIdx) / 12 - 2;
      var octaveNotes = noteNumbersToNames.rows[octave-1];
      if (noteIdx == 0) {
        octaveNotes = noteNumbersToNames.rows[octave-1] = { cols: [] };
      }
      octaveNotes.cols.push({ number: i, name: noteNames[noteIdx] + octave });
    }
    //console.log(noteNumbersToNames);

    var steps = [];
    for (var i = 0; i < 8; i++) {
      steps[i] = { stepNum: i, notes: noteNumbersToNames.rows };
    }
    
    $.templates({
      sequencer: templateSequencer,
      stepGroup: templateSeqSteps,
      stepInput: templateStepInput,
      notesTable: templateNotesTable
    });

    $(seqPanel).append($.render.sequencer({ steps: steps }));

    for (var i = 0; i < 8; i++) {

      $("#stepEnabled"+i).buttonset();
      $("#stepEnabled"+i).click(
        function(index, value) {
          var element = $(this);
          var stepNumber = element.attr("id").substr(-1);
          
          var formElements = document.forms["sequencer"].elements;

          var display = "off";
          var noteName = $("#stepNote" + stepNumber).attr("noteName");

          // TODO: write an "isStepEnabled" function
          if (formElements["stepEnabled" + stepNumber].value > 0) {  
            if (noteName == "") {
              noteName = "c1";
              $("#stepNote" + stepNumber).attr({
                noteName: noteName,
                value: "36"
              });
            }
            display = noteName;

            // highlight cell containing note name in table
            $("#noteTable" + stepNumber + " td").each(
              function(index, cell) {
                cell = $(cell);
                if (cell.text() == noteName) {
                  cell.attr("selected", "selected").css("background", "#bbb");
                  $("#stepNote" + stepNumber).attr({
                    value: cell.attr("notenumber")
                  });
                  return;
                }
              }
            );

          } else {
            $("#stepNote" + stepNumber).attr("value", "0");
            var bg = "#fff";
            if (noteName.substr(-1) % 2 == 0) {
              bg = "#eee";
            }
            var selectedCell = $("#noteTable" + stepNumber + " td[selected='selected']")
            selectedCell.removeAttr("selected").css("background", bg);

          }
          $("#stepButton" + stepNumber + " > span").html(display);
        }
      );

    }

    $(".noteCell").click(
      function() {
        var element = $(this);
        var name = element.text();
        var number = element.attr("notenumber");
        //console.log(name + ", " + number);

        var containerDiv = element.closest(".noteVeloChooser");
        var containerId = containerDiv.attr("id");

        var stepNumber = containerId.substr(-1);
        //console.log(stepNumber);

        $("#" + containerId + " td").each(
          function(index, cell) {
            cell = $(cell);
            var background = "#fff";
            if ((cell.text().substr(-1) % 2) == 0) {
              background = "#eee";
            }
            cell.css("background", background);
          }
        );
        element.attr("selected", "selected").css("background", "#bbb");
        $("#stepNote" + stepNumber).attr({
          value: number,
          noteName: name
        });

        var enabledElement = document.forms["sequencer"].elements["stepEnabled" + stepNumber];
        
        if (enabledElement.value > 0) {
          $("#stepButton" + stepNumber + " > span").html(name);
        } else {
          // enable step is it's not already
          enabledElement.value = 127;
          document.forms["sequencer"].elements["stepEnabled" + stepNumber + "2"].checked = true;
          $("#stepEnabled" + stepNumber).buttonset("refresh");
          $("#stepButton" + stepNumber + " > span").html(name);
        }

      }
    );

    $(".stepVelo").knob({
      'min':0,
      'max':127,
      'width': '60',
      'height': '90',
      'cursor': false,
      'thickness': .25,
      'angleOffset': -150,
      'angleArc': 300,
      'fgColor': '#fff',
      'bgColor': '#000',
      'inputColor': "#000",
      'cursor': 11
    });

    $(".stepButton").button().click(
      function(e) {
        var stepId = $(this).attr("id").substr(-1, 1);
        //console.log(stepId);

        // hide all note choosers and display one for current step
        $(".noteVeloChooser").fadeOut(300);
        setTimeout(
          function() {
            $("#noteVeloChooser" + stepId).fadeIn(300);
          },
          300
        );

        return false;
      }
    );

    $("#noteVeloChooser0").show();

    var self = this;
    $("#play").button().click(
      function(e) {
        self.play();
        return false;
      }
    );
    $("#stop").button().click(
      function(e) {
        self.stop();  
        return false;
      }
    );
  }  

};


var templateSequencer = `
  <style type="text/css">

  .stepsBar {
  	margin-top: 16px;
  }
  .dialogHeader input.seqButton {
  	font-size: .6em;
  	font-weight: bold;
  	color: #000;
  	font-family: 'Open Sans', sans-serif;
  	font-style: normal;
  	text-transform: uppercase;
  	border-bottom-right-radius: 4px;
    border-bottom-left-radius: 4px;
    border-top-right-radius: 4px;
    border-top-left-radius: 4px;
  }
  .dialogHeader .bpm {
  	font-size: .7em;
  }

  .stepSelection {
    margin-bottom: 8px;
  }
  .stepSelection h3 {
    margin: 0 0 4px 0;
    padding: 0;
    font-size: .7em;
    text-transform: uppercase;
  }

  .stepButton {
    width: 75px;
  }

  .stepGroup {
    float: left;
  }
  .stepTie {
    float:left;
    width:72px;
    border:0px solid #000;
    margin-right:8px;
    position:relative;
    top:0px;
    left:0px
  }
  .noteTable {
    border: 0px solid #000;
    border-collapse: collapse;
    padding: 0;
    text-align: center;
    width: 370px;
    font-size: .7em;
    float: right;
    font-family: 'Open Sans', sans-serif;
  }
  .noteTable td {
    border: 1px solid #000;
    padding: 8px;
    margin: 0;
  }
  .noteTable td:hover {
    background: #ccc;
  }
  .noteTable tr:nth-child(even) {
    background: #ddd;
  }

  .noteVeloChooser {
    position: absolute;
    top: 105px;
    left: 20px;
    width: 546px;
  }
  </style>

  <form id="sequencer" name="sequencer">
  <input class="bpm" id="bpm" type="text" size="4" name="bpm" value="100" /> <span style="font-size:.7em">bpm</span>
  <input type="submit" id="play" name="play" value="play" class="seqButton" />
  <input type="submit" id="stop" name="stop" value="stop" class="seqButton" />

  <div class="stepsBar">
    {{for steps tmpl="stepGroup"/}}
  </div>
  </form>
`;

var templateSeqSteps = `
	
  <div class="stepGroup">
    <div>
      <button class="stepButton" id="stepButton{{:stepNum}}">step {{:stepNum + 1}}</button>
    </div>
    <div class="stepTie" id="stepTie{{:stepNum}}">&nbsp;</div>
    
    {{include tmpl="stepInput"/}}
  </div>
  
`;

var templateStepInput = `
  
  <div class="noteVeloChooser" id="noteVeloChooser{{:stepNum}}" style="display:none">
    
    <input name="stepNote{{:stepNum}}" id="stepNote{{:stepNum}}" type="hidden" noteName="" value="0" />

    <table id="noteTable{{:stepNum}}" class="noteTable">
    {{for notes tmpl="notesTable"/}}
    </table>

    <div> 
      <div id="stepEnabled{{:stepNum}}" class="stepSelection">
        <h3>step {{:stepNum + 1}}</h3>
        <input type="radio" id="stepEnabled{{:stepNum}}1" name="stepEnabled{{:stepNum}}" checked="checked" value="0"/><label for="stepEnabled{{:stepNum}}1">off</label>
        <input type="radio" id="stepEnabled{{:stepNum}}2" name="stepEnabled{{:stepNum}}" value="127"/><label for="stepEnabled{{:stepNum}}2">on</label>
      </div>
      
      <div class="stepSelection">
      <h3>velocity</h3>
      <input type="text" class="stepVelo" name="stepVelo{{:stepNum}}" value="64" />
      </div>
    </div>

  </div>
  
`;

var templateNotesTable = `
<tr>
{{for cols}}
<td class="noteCell" noteNumber="{{:number}}">{{:name}}</td>
{{/for}}
</tr>

`;


$(window).on("unload", function() { sequencer.stop(); });



