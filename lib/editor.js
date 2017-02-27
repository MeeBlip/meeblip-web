
var editor = {

  initKnobs: function() {
    $(".dial").knob(
      {
          'min':0,
          'max':127,
          'width': '70',
          'height': '100',
          'cursor': false,
          'thickness': .25,
          'angleOffset': -150,
          'angleArc': 300,
          'fgColor': '#fff',
          'bgColor': '#000',
          'inputColor': "#000",
          'cursor': 11
      }
    );    
  },

  initSwitches: function() {
    $("#sustain").buttonset();
    $("#octave").buttonset();
    $("#lDest").buttonset();
    $("#pwmSweep").buttonset();
    $("#lRand").buttonset();
    $("#lNoteRetrig").buttonset();    
  },

  mapQueryParamsToForm: function() {
    var form = document.forms["editor"];
    var uri = document.documentURI;
    var queryIdx = uri.indexOf("?");
    if (queryIdx != -1) {
      var query = uri.substr(queryIdx+1, uri.length-1);
      var nameValPairs = query.split("&");
      for (var i = 0; i < nameValPairs.length; i++) {
        var nameValue = nameValPairs[i].split("=");
        //console.log(nameValue);
        form.elements[nameValue[0]].value = nameValue[1];
      }
    }
  },

  // might make more sense in midiAccess.js since it has code to
  // populate port select options?
  mapStateToSelectBoxes: function() {
    // pre-select port and channel if state exists
    var state = history.state;
    if ((state != null) && (typeof state["p"] != "undefined")) {
      //console.log("have state, setting port and channel to last used: " + state);
      var ports = document.forms["editor"].elements["port"];

      for (var i = 0; i < ports.options.length; i++) {
        //console.log("checking port: " + ports.options[i].text);
        if (ports.options[i].text == state["p"]) {
          port.selectedIndex = i;
          break;
        }
      }
      var channels = document.forms["editor"].elements["channel"];
      for (var i = 0; i < channels.options.length; i++) {
        if (channels.options[i].text == state["c"]) {
          channels.selectedIndex = i;
          break;
        }
      }
    }    
  },

  updateSwitch: function(radioInput, paramName, onOrOff) {
    if (radioInput.value == onOrOff) {
      radioInput.checked = true;
      $("#"+paramName).buttonset("refresh");
      //console.log("set");
      return true;
    }
    //console.log("skip");
    return false;
  },

  loadControlBar: function(controlBarId, channels) {
    $(controlBarId).append(
      $.templates(this.controlBarTemplate).render({
        channels: channels
      })
    );
    // after control bar widgets added to DOM initiate MIDI access
    midi.requestMidiAccess(this);

    // then check URI for form params and state for previously used port and channel
    this.mapQueryParamsToForm();

    this.loadShareLinkPanel("#shareUrl");
    this.loadPatchTable("#patchBrowser");
    sequencer.loadTemplate("#seqPanel");

    var updateHistoryState = function(selectId, field) {
      var state = history.state;
      if (state == null) {
        state = {};
      }
      state[field] = $(selectId + " option:selected").text();
      history.replaceState(state, "", document.documentURI);
    }

    $("#port").change(
      function() {
        updateHistoryState("#port", "p");
      }
    );
    $("#channel").change(
      function() {
        updateHistoryState("#channel", "c");
      }
    );

    $("editor").keypress(
      function(e) {
        if (e.which == 13) {
          $("#send").click();
          return false;
        }
      }
    );

  },

  controlBarTemplate: `
    <b>MIDI</b>
    <select name="port" id="port">
      <option value="none">port</option>
    </select>
    
    <select name="channel" id="channel">
      {{for channels}}
      <option value="{{:#data}}">{{:#data}}</option>
      {{/for}}
    </select>
    <input type="submit" id="send" name="send" value="send" class="controlButton" />
    <input type="submit" id="share" name="share" value="patch link" class="controlButton" />
    <input type="submit" id="surprise" name="surprise" value="gen random" class="controlButton" />
    <input type="submit" id="patches" name="patches" value="patches" class="controlButton" />
    <input type="submit" id="seq" name="seq" value="seq" class="controlButton" />
    
    <div id="shareUrl" title="bookmark to save, copy to share" style="display:none"></div>
    
    <div id="patchBrowser" title="click a patch link to load" style="display:none"></div>

    <div id="seqPanel" title="sequencer" style="display:none"></div>

  `,

  loadPatchTable: function(patchBrowserId) {
    var self = this;

    $(patchBrowserId).append($.templates(this.patchTableTemplate).render({ patches: patches }));

    $("#patches").button().click(
      function(event) {
        $("#patchBrowser").dialog({
          closeOnEscape: true,
          width: 420,
          dialogClass: "dialogHeader",
          height: 350,
          modal: true,
          position: { my: "center top", at: "left bottom", of: $("#patches") }
        });

        return false;
      }
    );
    $('#patchTable').DataTable({
      ordering: true,
      info: true,
      paging: true,
      pagingType: "simple",
      lengthChange: false,
      pageLength: 6,
      drawCallback: function() {
        $("td a.patchLink").click(
          function() {
            return self._loadPatchLink($(this), patchBrowserId);
          }
        );
      }
    });

  },

  patchTableTemplate: `
      <span class="ui-helper-hidden-accessible"><input type="text"/></span>
      <table id="patchTable">
        <thead>
        <tr>
        <th>patch</th>
        <th>description</th>
        </tr>
        </thead>
        <tbody id="patchTableBody">
        {{for patches}}
        <tr>
          <td style="width:30%"><a class="patchLink" href="{{:href}}">{{:name}}</a></td>
          <td>{{:description}}</td>
        </tr>
        {{/for}}
        </tbody>
      </table>

  `,

  loadShareLinkPanel: function(shareUrlId) {
    var self = this;

    $("#share").button().click(
      function(event) {
        var params = "?";
        //console.log(event);
        var f = document.forms["editor"];
        for (var i = 0; i < f.elements.length; i++) {
            var e = f.elements[i];
            if (formToCCs[e.name] === undefined) {
              continue;
            }
            if (e.type == "radio") {
              if (!e.checked) {
                continue;
              }
            }
            var val = e.value;
            params += e.name+"="+e.value+"&";
        }
        params = params.substr(0, params.length - 1);
        
        var uri = document.documentURI;
        var queryStart = uri.indexOf("?")
        if (queryStart != -1) {
          uri = uri.substr(0, queryStart);
        }

        var shareUrl = uri + params;
        //console.log(shareUrl);

        $(shareUrlId).empty();
        $(shareUrlId).append('<span class="ui-helper-hidden-accessible"><input type="text"/></span>');
        $(shareUrlId).dialog({
          closeOnEscape: true,
          width: 340,
          dialogClass: "dialogHeader",
          height: 100,
          modal: true,
          position: { my: "center top", at: "left bottom", of: $("#share") }
        }).append('<p style="text-align:center"><b><a class="patchLink" href="' + shareUrl + '">link for current patch</a></b></p>');

        $("p a.patchLink").click(
          function() {
            return self._loadPatchLink($(this), shareUrlId);
          }
        );

        return false;
      }
    );

  },

  _loadPatchLink: function(patchLinkElement, dialogId) {
    //console.log(patchLinkElement);
    var href = patchLinkElement.attr("href");

    var queryParams = href.substr(href.indexOf('?'));

    var uri = document.documentURI;
    var queryStart = uri.indexOf("?")
    if (queryStart != -1) {
      uri = uri.substr(0, queryStart);
    }
    var link = uri + queryParams;

    var state = {
      p: midi.selectedPort(),
      c: midi.selectedChannel() + 1
    };
    //console.log(state);

    history.replaceState(state, "", link);

    this.mapQueryParamsToForm();

    $(dialogId).dialog("close");

    // re-draw form widgets after form values updated
    $(".dial").trigger('change');
    $(".switch").buttonset('refresh');

    return false;
  }
}