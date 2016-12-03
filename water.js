/**
 * 
 */

var app = require('express')();
var fs = require('fs');
var http = require('http').Server(app);
var io = require('socket.io')(http);

var listenerCount = 0;
var supremeLeaderCount = 0;


app.get('/', function(req, res){
	  res.sendFile(__dirname + '/waterIndex.html');
});

app.get('/controller', function(req, res){
	res.sendFile(__dirname + '/waterCommand.html');
});

//remember, this fun regular expression is what allows you to load resources by name (e.g., "scripts/IntermittentSound.js" from served html files
app.get(/^(.*)$/, function(req, res){
	//console.log(req.params[0]);
	res.sendFile(__dirname + req.params[0]);
});

io.on('connection', function(socket){
  //console.log('a user connected');
  socket.on('disconnect', function(){
	  if (socket.birdType == "listener") {
		  listenerCount--;
		  console.log('listener disconnected; listeners remaining: ' + listenerCount);
	  } else if (socket.birdType == "supreme leader") {
		  supremeLeaderCount--;
		  console.log('supreme leader disconnected; supreme leaders remaining: ' + supremeLeaderCount);
	  } else {
		  console.log('mystery user disconnected');
	  }
  });
  socket.on('control message', function(msg){
	  //these are coming from the controller and going to all listeners
	  console.log('control message: ' + msg);
	  io.emit('control message', msg);
  });
  //unused; this is from original chat demo
  socket.on('message', function(msg){
	    io.emit('message', msg);
	    console.log('message: ' + msg);
  });
  socket.on('i am', function(msg){
	    //io.emit('message', msg);
	  	//you could add a property that is name, so we can know who's disconnecting as well
	    if (msg == 'listener') {
	    	socket.birdType = msg;
	    	listenerCount++;
	    	console.log("listener connected; listeners: " + listenerCount); 
	    	fileToPush = "audio/stream.mp3";
    		pushSoundToClient(fileToPush, 0, socket);
	    } else if (msg == 'supreme leader') {
	    	socket.birdType = msg;
	    	supremeLeaderCount++;
	    	console.log("supreme leader connected; supreme leaders: " + supremeLeaderCount);
	    } else if (msg == 'max patch') {
	    	socket.birdType = msg;
	    	console.log("max patch connected");
	    } else {
	    	console.log("mystery user connected");
	    }
  });

  socket.on('make dir', function(msg){
	  //io.emit('chat message', msg);
	  fs.mkdir(msg, function(err) {
		  if(err) {
			  console.log(err);
		  } else {
			  console.log('new directory: ' + msg);
		  }
	  });
  });

  socket.on('post audio', function(msg){
	  console.log(Date.now());
	  //io.emit('chat message', msg);
	  var fileName = msg[1] + "/Birds" + msg[2] + ".wav";
	  fs.writeFile(birdFileName, msg[0], 'base64', function(err) {
		  if(err) {
			  console.log("FOOL! " + err);
		  } else {
			  console.log(Date.now());
			  console.log('posting file ' + birdFileName);
			  //loadSound(msg[2], socket);
			  //io.emit('chat message', msg[2]);
		  }
	  });
	  //console.log('posting file...');
  });
  //socket.emit('audio', { audio: true, buffer: referenceTone, index: 0 });
  socket.emit('get type', 'because you just connected!');
});

function pushSoundToClient(filename, bufferIndex, socket) {
	//console.log('Pushing ' + filename + ' to buffer index ' + bufferIndex + ' on socket ' + socket);
	fs.readFile(filename, function(err, buf){
		if (err) {
			console.log("Error: " + err);
		} else {
			//console.log('audio index:' + bufferIndex);
		    socket.emit('audio', { audio: true, buffer: buf, index: bufferIndex });
		}
	});
}

/*
var referenceTone;
var fileToRead = __dirname + '/sounds/Fl_G4b.wav';
fs.readFile(fileToRead, function(err, buf){
	// loading pitch reference/test file
	if (err) {
		console.log("Error: " + err);
	} else {
		referenceTone = buf;
		console.log('pitch reference loaded');
	}
});
*/

// is it possible that we could start listening and someone could connect before referenceTone is loaded?
http.listen(8300, function(){
  console.log('listening on *:8300');
});

