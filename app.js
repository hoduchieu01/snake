var express = require('express');
const { reset } = require('nodemon');
var app = express();
var serv = require('http').Server(app);

app.engine('html', require('ejs').renderFile);

app.use('/assets',express.static('assets'));

app.get('/',function(req, res){
	res.sendFile(__dirname + '/home.html');
});

app.post('/playerlogin',function(req, res){
	let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
		res.render(__dirname + '/player.html', {'name': body.substr(5)});
	});
});

app.get('/adminlogin1610',function(req, res){
	res.sendFile(__dirname + '/admin.html');
});

serv.listen(process.env.PORT);
//console.log("Server is Running on http://localhost:2000 ...");



var SOCKET_LIST = {};
var chance=0;
var list_socket = [];
var PLAYER_LIST = {};
var LOGS = [];
var TELEPORT = [{'sx':4,'sy':3,'ex':0,'ey':4},{'sx':4,'sy':6,'ex':3,'ey':8},{'sx':8,'sy':2,'ex':5,'ey':5},{'sx':8,'sy':9,'ex':9,'ey':7},{'sx':6,'sy':2,'ex':5,'ey':0},{'sx':1,'sy':0,'ex':9,'ey':3}]
//Player
var Player = function(id){
	var self = {
		x:0,
		y:550,
		id:id,
		dice: 0,
		state: true,
		name: '',
		maxSpd: 5,
		winstatus: -1,
		previousDice: 0,
		color: '#' + Math.floor(Math.random()*16777215).toString(16),
		isadmin: false,
		score: 0
	}

//Updating Player Position
	self.updatePosition = function(){
		// console.log(self.x,self.y);

		if(self.state){	
			if(self.dice>0)self.state = false;
		}else{ 
			if(self.x==0&&self.y==55){
				self.winstatus = 0;
				for(p in PLAYER_LIST) if(p.winstatus==-1)p.winstatus=1;
				return;
			}

			if(Math.floor(self.y)%2 == 0){
				self.x += 55;
				self.dice -= 55;
				if(self.x==550){
					self.y-=55;
					self.x -= 55;
				}
			}else if(Math.floor(self.y)%2 == 1){
				self.x -= 55;
				self.dice -= 55;
				if(self.x<0){
					self.y -= 55;
					self.x += 55;
				}
			}
			if(self.dice<=0)self.state=true;
		}

		if(self.dice==0)
		for( d in TELEPORT){
			// console.log(TELEPORT[d]);
			// console.log(self);
			if(TELEPORT[d].sx*55 == self.x && TELEPORT[d].sy*55 + 55 == self.y){
				self.x = TELEPORT[d].ex*55;
				self.y = 55+TELEPORT[d].ey*55;
				self.dice=0;
				break;
			}
		}
	}
	

	return self; 
}


var single =true;

//Socket Connection
var io = require('socket.io')(serv,{});
io.sockets.on('connection',function(socket){
	//socket ID
	socket.id = Math.random();
	SOCKET_LIST[socket.id]= socket;
	list_socket.push(socket);
	var player = Player(socket.id);
	PLAYER_LIST[socket.id]= player;
	
	socket.emit('target',TELEPORT);
	socket.on('disconnect', function(){
		list_socket = list_socket.filter(item => item !== socket)
		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});
	
	socket.on('myname',function(data){
		PLAYER_LIST[socket.id].name = data['name'];
	});

	socket.on('iamadmin',function(){
		//console.log("Hello");
		PLAYER_LIST[socket.id].isadmin = true;
	});

	//drice values
	socket.on('dice', function(data){
		var chanceDebug = true;
		if(player.isadmin){
			console.log(data,'Admin Dice Received');
			if(LOGS.length>0 && PLAYER_LIST[LOGS[LOGS.length-1].id] != undefined){
				single = true;
				PLAYER_LIST[LOGS[LOGS.length-1].id].previousDice = data.random;
				PLAYER_LIST[LOGS[LOGS.length-1].id].dice = data.random*55;
				chance++;
			}else if(LOGS.length>0){
				while(PLAYER_LIST[list_socket[chance % list_socket.length].id].isadmin!=false){chance++;console.log("Looping to find player!");}
			}
		}else{
			while(PLAYER_LIST[list_socket[chance % list_socket.length].id].isadmin!=false){chance++;console.log("Looping to find player!");}
			if(chanceDebug || list_socket[chance % list_socket.length] == socket){
				console.log(data,'Player Dice Received');
				if(single){
				LOGS.push({'id':socket.id,'name':player.name,'dice':data.random,'isadmin':player.isadmin});
				single = false;
				}
			}
		}
		
	});

});
	 
	

setInterval(function(){
	var pack = [];
	var check = false;

	for(var i in PLAYER_LIST){
		var player = PLAYER_LIST[i];
		if(player.dice){
			check = true;
		}

		player.updatePosition();
		if(player.winstatus==0){
			SOCKET_LIST[player.id].emit('win', 'Congratulation, You Win!');
		}
		
		pack.push({
			x:player.x,
			y:player.y-15,
			id:player.id,
			color: player.color,
			dice_value: player.dice/55,
			win:player.winstatus,
			previousDice: player.previousDice,
			isadmin:player.isadmin,
			score:player.score,
			name:player.name
		});
	}
	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('newPositions',pack);
		socket.emit('logs',LOGS);
	}
	
},1000/30);
