/**
 * GranularSynth
 * by Ben Houge
 * A pretty straightforward granular synthesis implementation based on a provided audio buffer.
 * Uses a half sine window by default, but that can be overridden.
 * Grains play asynchronously; someday I might add a flag to allow synchronous playback as well.
 * Might be nice to change to a "percentage of deviation" model for asynchronous grains
 */

// creating a GranularSynth object with an object constructor
function GranularSynth(buffer, grainsPerSec, minGrainDur, maxGrainDur, minVol, maxVol, minPitch, maxPitch) {
	this.buffer = buffer;
	this.grainsPerSec = grainsPerSec;
	this.minGrainDur = minGrainDur;
	this.maxGrainDur = maxGrainDur;
	this.minVol = minVol;
	this.maxVol = maxVol;
	this.minPitch = minPitch;
	this.maxPitch = maxPitch;
	this.outputNode;
	this.isPlaying = false;
	this.grainWindow = (function() {
		//Set half sine up as default, but allow it to be overridden
		var grainWindow;
		var grainWindowLength = 16384;
		grainWindow = new Float32Array(grainWindowLength);
		for (var i = 0; i < grainWindowLength; ++i)
		    grainWindow[i] = Math.sin(Math.PI * i / grainWindowLength);
		return grainWindow;
	})();
	this.targetTime;

	// should this all be made private?
	this.pitchArray = [];
	if (typeof(minPitch) == 'number') {
		this.pitchArray.push(minPitch);
	} else {
		this.pitchArray = pitch.sort();
	}
	this.currentPitch;
	this.lastPitch = 0.;
	this.minReps = 0;
	this.maxReps = 0;
	this.phraseDur = 0.;
	
	var grainTimerID;
	var phraseTimerID;
	var numberOfReps;
	var descendingTargetTime;
	var octaveMultiplier;
	var isDescending;
	// remember, we do this so that we can access member variables in private functions
	// http://www.crockford.com/javascript/private.html
	var that = this;
	
	function playGrain(bufferToPlay, grainDuration, pitchMultiplier, volume) {
		// this will be in seconds, adjusted for pitch
		var bufferDuration = (bufferToPlay.length/bufferToPlay.sampleRate)/pitchMultiplier;
		var startTime;
		if (grainDuration > bufferDuration) {
			grainDuration = bufferDuration;
			startTime = 0;
		} else {
			startTime = (bufferDuration - grainDuration) * Math.random() * pitchMultiplier;
		}
		
		var context = that.outputNode.context;
		var fileNode = context.createBufferSource();
		var gainNode = context.createGain();
		var gainNode2 = context.createGain();
		gainNode.connect(gainNode2);
		gainNode2.connect(that.outputNode);
		gainNode2.gain.value = volume;
		fileNode.buffer = bufferToPlay;	
		fileNode.connect(gainNode);
		fileNode.playbackRate.value = pitchMultiplier;
		
		
		//super hacky, revisit, but seems to work for now!
		var slightDelay = audioCtx.currentTime + 0.1;
		// delay before starting, time into buffer, duration of excerpt
		fileNode.start(slightDelay, startTime, grainDuration * pitchMultiplier);
		// windows, start time, duration
		gainNode.gain.setValueCurveAtTime(that.grainWindow, slightDelay, grainDuration);
		
		//fileNode.start(0., startTime, grainDuration * pitchMultiplier);
		//gainNode.gain.setValueCurveAtTime(that.grainWindow, 0., grainDuration);
		
	}
	
	function scheduledGrainPlayer() {
		// play grain
		// calculate next grain time
		// if next grain time < toneEndTime, schedule next grain

		var secsPerGrain = 1. / that.grainsPerSec;
		var grainDuration = (that.maxGrainDur - that.minGrainDur) * Math.random() + that.minGrainDur;
		var volume = (that.maxVol - that.minVol) * Math.random() + that.minVol;
		var pitch = (that.maxPitch - that.minPitch) * Math.random() + that.minPitch;
		//console.log(pitch);
		playGrain(that.buffer, grainDuration, pitch, volume);
		//remember, all in seconds...
		var timeToNextGrain = (2. * secsPerGrain) * Math.random();
		//var timeToNextGrain = that.grainsPerSec;
		var nextGrainTime = that.outputNode.context.currentTime + timeToNextGrain;
		if (that.isPlaying) {
			//remember, setTimeout wants ms...
			var timeToNextGrainInMs = timeToNextGrain * 1000.;
			if (timeToNextGrainInMs < 10.) {
				timeToNextGrainInMs = 10.;
			}
			grainTimerID = window.setTimeout(scheduledGrainPlayer, timeToNextGrainInMs);
		}
	}
	
	function scheduledPhrasePlayer() {
		var currentPhraseDur = that.play();
		if (numberOfReps > 0) {
			phraseTimerID = window.setTimeout(scheduledPhrasePlayer, currentPhraseDur * 1000.)
			numberOfReps--;
		} else if (that.outputNode.context.currentTime < descendingTargetTime || 
				that.pitchArray.indexOf(that.lastPitch) != 0) {
			phraseTimerID = window.setTimeout(scheduledPhrasePlayer, currentPhraseDur * 1000.)
		}
	}
	
	this.connect = function(nodeToConnectTo) {
		try {
			if (nodeToConnectTo.destination) {
				this.outputNode = nodeToConnectTo.destination;
			} else {
				this.outputNode = nodeToConnectTo;
			}
		} catch(e) {
			alert("It seems you have not specified a valid node.");
		}
	}
	
	this.play = function() {
		this.isPlaying = true;
		//note that these are in seconds
		
		
		that.startTime = this.outputNode.context.currentTime;
		//this.targetTime = that.startTime + this.toneDur;
		scheduledGrainPlayer();
		//return this.toneDur;
	}
	
	this.playRandomPhrase = function(minReps, maxReps, octaveShift) {
		isDescending = false;
		this.minReps = minReps;
		this.maxReps = maxReps;
		this.phraseDur = 0.;
		numberOfReps = Math.floor(((maxReps - minReps) + 1) * Math.random() + minReps);
		octaveMultiplier = 1 + Math.floor((octaveShift + 1) * Math.random());
		if (octaveMultiplier > 1.) {
			this.minVol *= 0.5;
			this.maxVol *= 0.5;
		}
		scheduledPhrasePlayer();
	}
	
	this.playDescendingPhrase = function(phraseDuration, octaveShift) {
		isDescending = true;
		this.minReps = 0;
		this.maxReps = 0;
		this.phraseDur = phraseDuration;
		descendingTargetTime = this.outputNode.context.currentTime + phraseDuration;
		numberOfReps = 0;
		octaveMultiplier = 1 + Math.floor((octaveShift + 1) * Math.random());
		if (octaveMultiplier > 1.) {
			this.minVol *= 0.5;
			this.maxVol *= 0.5;
		}
		scheduledPhrasePlayer();
	}

	this.stop = function() {
		this.isPlaying = false;
		window.clearTimeout(grainTimerID);
		window.clearTimeout(phraseTimerID);
	}
}


