var io = require('socket.io').listen(1380);

var sockets = {}, players = {}, bombs = {}, nextId = 1, nextBombId = 1, totalPlayers = 0, alivePlayers = 0, timeleft = 0;

/*
* 0 - empty
* 1 - destroyable wall
* 2 - wall
* template special:
*   -1 - must be empty
* map special:
*   -2 - explosion
*   -3 - flame++
*   100 - muffin (bomb)
*/
var map, map_template = [
		[-1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1],
		[-1, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, -1],
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0],
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		[-1, 2, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, -1],
		[-1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1]
	];

setInterval(function() {
	timeleft--; 
	if (timeleft <= 0 && !starting) {
		starting = true;
		setTimeout(newGame, 3000);
	}
}, 1000);

// update player positions
function update(timestamp) {
	for (var id in players) if (players[id].playing) {
		var p = players[id];

		/* moving */
		var power = (timestamp - p.timestamp) / 6;
		p.timestamp = timestamp;
		if (power == 0) continue;
		while (power > 0) {
			var kx = 0, ky = 0;
			if (p.keys[0]) {
				kx -= 1;
			}
			if (p.keys[1]) {
				ky -= 1;
			}
			if (p.keys[2]) {
				kx += 1;
			}
			if (p.keys[3]) {
				ky += 1;
			}

			var posx = Math.floor(p.x / 50);
			var posy = Math.floor(p.y / 50);
		
			var rposx = Math.floor((p.x + 25) / 50);
			var rposy = Math.floor((p.y + 25) / 50);
			var rposi = map[rposy][rposx];
			// ignore muffin if player is standing on it
			if (rposi == 100) {
				map[rposy][rposx] = 0;
			}
		
			var mx = 0, my = 0, amp = 0;

			// normal move
			if (p.y % 50 == 0) {
				if (kx > 0) {
					if (map[posy][posx + 1] <= 0) {
						amp = 50 - p.x % 50;
						mx = 1;
						kx = ky = 0;
					}
				} else if (kx < 0) {
					if (map[posy][posx - 1] <= 0) {
						amp = 50;
					}
					amp += p.x % 50;
					if (amp > 0) {
						mx = -1;
						kx = ky = 0;
					}
				}
			}	
			if (p.x % 50 == 0) {
				if (ky > 0) {
					if (posy + 1 < map.length && map[posy + 1][posx] <= 0) {
						amp = 50 - p.y % 50;
						my = 1;
						kx = ky = 0;
					}
				} else if (ky < 0) {
					if (posy > 0 && map[posy - 1][posx] <= 0) {
						amp = 50;
					}
					amp += p.y % 50;
					if (amp > 0) {
						my = -1;
						kx = ky = 0;
					}
				}
				ky = 0;
			}

			// around the corners
			if (kx != 0) {
				if (map[posy][posx + kx] <= 0) {
					amp = p.y % 50;
					my = -1;
					kx = ky = 0;
				} else if (posy + 1 < map.length && map[posy + 1][posx] <= 0 && map[posy + 1][posx + kx] <= 0) {
					amp = 50 - p.y % 50;
					my = 1;
					kx = ky = 0;
				}
			}
			if (ky != 0) {
				if (posy + ky >= 0 && posy + ky < map.length) {
					if (map[posy + ky][posx] <= 0) {
						amp = p.x % 50;
						mx = -1;
						kx = ky = 0;
					} else if (map[posy][posx + 1] <= 0 && map[posy + ky][posx + 1] <= 0) {
						amp = 50 - p.x % 50;
						mx = 1;
						kx = ky = 0;
					}
				}
			}
		
			map[rposy][rposx] = rposi;
	
			if (amp == 0) break;
			amp = Math.min(amp, power);
			p.x += mx * amp;
			p.y += my * amp;
			power -= amp;
		}
	}
}

// send message to everypony in the room
function toRoom(event, data) {
	for(var id in sockets) {
		sockets[id].emit(event, data);
	}
}

// check if game should be restarted
function checkAlive() {
	if (alivePlayers < 2 && alivePlayers != totalPlayers && !starting) {
		starting = true;
		setTimeout(newGame, 3000);
	}
}

// boom goes the muffin
function boom(bid, chain) {
	if (!bombs[bid]) return [];
	map[bombs[bid].y][bombs[bid].x] = 0;
	toRoom('boom', {id: bid});

	update(Date.now());

	pos_map = {};
	for (var id in players) if (players[id].playing) {
		var p = players[id];
		var pos = Math.floor((p.x + 25) / 50) + ' ' + Math.floor((p.y + 25) / 50);
		if (!pos_map[pos]) pos_map[pos] = [];
		pos_map[pos].push({type: 'p', id: id});
	}
	for (var id in bombs) if (id != bid) {
		var b = bombs[id];
		var pos = b.x + ' ' + b.y;
		if (!pos_map[pos]) pos_map[pos] = [];
		pos_map[pos].push({type: 'b', id: id});
	}

	var b = bombs[bid];
	var dirs = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]];
	var explode = [], explosion = [];
	for (var dir in dirs) {
		for (var i = 1; i <= players[b.player].flame; i++) {
			var x = b.x + i * dirs[dir][0], y = b.y + i * dirs[dir][1];
			if (y < 0 || y >= map.length || x < 0 || x >= map[0].length || map[y][x] == 2 || map[y][x] == -2) break;
		
			if (map[y][x] == 1) {
				if (Math.floor(Math.random() * 4) == 0) {
					map[y][x] = -3;
				} else {
					map[y][x] = -2;
					explosion.push({x: x, y: y});
				}
				break;
			}
		
			map[y][x] = -2;
			explosion.push({x: x, y: y});
		
			var p = pos_map[x + ' ' + y];
			if (p) {
				for (var j in p) {
					if (p[j].type == 'b') {
						explode.push(p[j].id);
					} else if (p[j].type == 'p') {
						players[p[j].id].playing = false;
						alivePlayers--;
						toRoom('move', {id: p[j].id, data: players[p[j].id]});
					}
				}
				break;
			}
		}
	}

	delete bombs[bid];

	for (var i in explode) {
		explosion = explosion.concat(boom(explode[i], true));
	}

	if (chain) {
		return explosion;
	} else {
		toRoom('map', map);

		setTimeout(function(explosion) {
			for (var i in explosion) {
				map[explosion[i].y][explosion[i].x] = 0;
			}
			toRoom('map', map);
		
			checkAlive();
		}, 500, explosion);
	}
}

// restart game
var starting = false;
function newGame() {
	console.log('new game');
	starting = false;
	
	timeleft = 90;

	bombs = {}

	map = [];
	for (var i = 0; i < map_template.length; i++) {
		map[i] = [];
		for (var j = 0; j < map_template[i].length; j++) {
			map[i][j] = 0;
			if (map_template[i][j] == 0 && Math.floor(Math.random() * 5) < 4) {
				map[i][j] = 1;
			} else if (map_template[i][j] > 0) {
				map[i][j] = map_template[i][j];
			}
		}
	}

	var pos = 0;
	for (var id in players) {
		var p = players[id];
		p.playing = true;
		p.keys = [false, false, false, false];
		p.flame = 1;
		if (pos == 0) {
			p.x = 0;
			p.y = 0;
			p.spriteY = 2;
		}
		if (pos == 1) {
			p.x = 600;
			p.y = 0;
			p.spriteY = 1;
		}
		if (pos == 2) {
			p.x = 0;
			p.y = 600;
			p.spriteY = 2;
		}
		if (pos == 3) {
			p.x = 600;
			p.y = 600;
			p.spriteY = 1;
		}
		pos = (pos + 1) % 4;
	}

	alivePlayers = totalPlayers;

	toRoom('game', {players: players, map: map, timeleft: timeleft});
}
newGame();

io.sockets.on('connection', function(socket) {
	var id = nextId++, name = 'Anon ' + id;
	var pony = Math.floor(Math.random() * 8);
	totalPlayers++;
	
	socket.emit('hello', {id: id, name: name, players: players, bombs: bombs, map: map, pony: pony, timeleft: timeleft});
	players[id] = {name: name, playing: false, pony: pony, x: 0, y: 0, keys: [false, false, false, false], spriteY: 2, flame: 1};
	sockets[id] = socket;
	toRoom('joined', {id: id, data: players[id]});
	
	socket.on('move', function(data) {
		if (players[id].playing) {
			players[id] = data;
			toRoom('move', {id: id, data: data});
			players[id].timestamp = Date.now();
		}
	});
	
	socket.on('plant', function(data) {
		var id = nextBombId++;
		bombs[id] = data;
		map[data.y][data.x] = 100;
		toRoom('plant', {id: id, data: data});
		setTimeout(boom, 2000, id);
	});
	
	socket.on('pickup', function(data) {
		if (map[data.y][data.x] == -3) {
			map[data.y][data.x] = 0;
			players[id].flame++;
			toRoom('flame', {id: id, flame: players[id].flame});
			toRoom('map', map);
		}
	});
	
	socket.on('rename', function(data) {
		players[id].pony = data.pony
		players[id].name = data.name;
		toRoom('rename', {id: id, name: data.name, pony: data.pony});
	});
	
	socket.on('disconnect', function() {
		totalPlayers--;
		if (players[id].playing) alivePlayers--;
		checkAlive();
		delete players[id];
		delete sockets[id];
		toRoom('gone', {id: id});
	});
	
	if (totalPlayers <= 2 && !starting) {
		starting = true;
		setTimeout(newGame, 1000);
	}
});
