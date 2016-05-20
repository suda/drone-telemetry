var App = function(){
  this._messagesCount = 0;
  this._pitchFiltered;
  this._pitchFilterTime = 0.05;
  this._rollFiltered;
  this._rollFlterTime = 0.05;
  this._headingFiltered;
  this._headingFilterTime = 0.01;
  this._climbingFiltered;
  this._climbingFilterTime = 0.01;

  this.initWidgets();
  this.initLagometer();
  this.initTimers();
  this.initEventSource();
};

App.prototype.initWidgets = function initWidgets() {
  this._attitudeIndicatorWidget =
    new PerfectWidgets.Widget("attitudeIndicator", jsonModel3);
  this._pitchSlider = this._attitudeIndicatorWidget.getByName("Pitch");
  this._rollSlider = this._attitudeIndicatorWidget.getByName("Roll");
  this._rollSlider.configureAnimation({"enabled": true, "ease": "swing", "duration": 0.1});
  this._pitchSlider.configureAnimation({"enabled": true, "ease": "swing", "duration": 0.1});

  this._verticalSpeedIndicatorWidget =
    new PerfectWidgets.Widget("verticalSpeedIndicator", jsonModel6);
  this._verticalSpeedSlider = this._verticalSpeedIndicatorWidget.getByName("Slider2");
  this._verticalSpeedSlider.configureAnimation({"enabled": false, "ease": "swing", "duration": 20});

  this._headingIndicatorWidget =
    new PerfectWidgets.Widget("headingIndicator", jsonModel4);
  this._directionSlider = this._headingIndicatorWidget.getByName("Slider1");
  this._directionSlider.configureAnimation({"enabled": false, "ease": "swing", "duration": 10});
}

App.prototype.initTimers = function initTimers() {
  this.renderData = setInterval(function(){
    this._rollSlider.setValue(this._pitchFiltered);
    this._pitchSlider.setValue(this._rollFiltered);

    this._verticalSpeedSlider.setValue(this._climbingFiltered / 10);
    this._directionSlider.setValue(this._headingFiltered);
  }.bind(this), 50);

  this.updateRps = setInterval(function(){
    this._lagSeries.append(new Date().getTime(), this._messagesCount);
    var t = 8;
    if (this._messagesCount < t) {
      var g = parseInt(255 * (this._messagesCount / t));
      var r = 255 - g;

      this._lagometer.seriesSet[0].options.strokeStyle = 'rgba(' + r +', ' + g + ', 0, 1)';
      this._lagometer.seriesSet[0].options.fillStyle = 'rgba(' + r +', ' + g + ', 0, 0.2)'
    }

    this._messagesCount = 0;
  }.bind(this), 50);
}

App.prototype.onEventSourceOpened = function onEventSourceOpened(event) {
  console.log("  Opened!");
}

App.prototype.onEventSourceError = function onEventSourceError(event) {
  if (event.readyState == EventSource.CLOSED) {
    console.log("  Closed!");
  } else {
    console.log("  Error!");
  }
}

App.prototype.onEventSourceMessage = function onEventSourceMessage(event) {
  this._messagesCount++;

  var dataFrame = this._unpackDataFrame(event.data);
  // Adjust pitch and roll due to alignment
  var pitch = -dataFrame.pitch;
  var roll = parseFloat(dataFrame.roll);
  roll = -(roll > 0 ? 180.0 - roll : -(180.0 + roll));
  var heading = dataFrame.heading * 2;

  // Filter the jitter (thx Julien!)
  if (!this._pitchFiltered) this._pitchFiltered = pitch;
  this._pitchFiltered = ((1.0 - this._pitchFilterTime) * this._pitchFiltered)
                        + (this._pitchFilterTime * pitch);

  if (!this._rollFiltered) this._rollFiltered = roll;
  this._rollFiltered = ((1.0 - this._rollFlterTime) * this._rollFiltered)
                        + (this._rollFlterTime * roll);

  if (!this._headingFiltered) this._headingFiltered = heading;
  this._headingFiltered = ((1.0 - this._headingFilterTime) * this._headingFiltered)
                        + (this._headingFilterTime * heading);

  if (!this._climbingFiltered) this._climbingFiltered = dataFrame.gz;
  this._climbingFiltered = ((1.0 - this._climbingFilterTime) * this._climbingFiltered)
                        + (this._climbingFilterTime * dataFrame.gz);
}

App.prototype.initEventSource = function initEventSource() {
  var address = window.localStorage.ip;
  if (!address) address = prompt("Enter server IP or hostname");
  if (!!address) window.localStorage.ip = address;
  $("#address").text(!!address ? address : 'Unknown address');

  this.eventSource = new EventSource('http://' + address);

  this.eventSource.addEventListener('open', this.onEventSourceOpened.bind(this), false);
  this.eventSource.addEventListener('error', this.onEventSourceError.bind(this), false);
  this.eventSource.addEventListener('message', this.onEventSourceMessage.bind(this), false);
}

App.prototype.initLagometer = function initLagometer() {
  this._lagSeries = new TimeSeries();
  this._lagometer = new SmoothieChart();
  this._lagometer.addTimeSeries(this._lagSeries, { strokeStyle: 'rgba(0, 255, 0, 1)', fillStyle: 'rgba(0, 255, 0, 0.2)', lineWidth: 4 });
  this._lagometer.streamTo(document.getElementById("chart"), 500);
  $("#chart").attr('width', window.innerWidth);
}

App.prototype.enterAddress = function enterAddress() {
  window.localStorage.removeItem('ip');
  this.initEventSource();
}

App.prototype._unpackDataFrame = function _unpackDataFrame(frame) {
  var d = frame.split(',');

  return {
    gx: d[0],
    gy: d[1],
    gz: d[2],
    ax: d[3],
    ay: d[4],
    az: d[5],
    mx: d[6],
    my: d[7],
    mz: d[8],
    pitch: d[9],
    roll: d[10],
    heading: d[11]
  };
}
