/* helper */
window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function( callback ){
                window.setTimeout(callback, 1000 / 60);
              };
    })();

/* game */
var socket, canvas, ctx, sprites, blocks, muffin,
	width = 650,
	height = 640,
	players = {},
	players_local = {},
	bombs = {},
	myid = -1,
	map,
	timeleft = 0;

setInterval(function() {
	timeleft--;
	if (timeleft < 0) timeleft = 0;
	$('#timer').html(timeleft + 's left');
}, 1000);

// update player positions
function update(delta) {
	for (var id in players) if (players[id].playing) {
		var p = players[id];
		if (!players_local[id]) {
			players_local[id] = {spriteX: 0, spriteTime: 0, moving: false, spriteY: p.spriteY};
		}
		var pl = players_local[id];
	
		/* moving */
		var power = delta / 6;
		if (power == 0) continue;
		var rmx = 0, rmy = 0;
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
			
			if (mx != 0 || my != 0) {
				rmx = mx;
				rmy = my;
			}
		}
	
		/* sprites */
		var nspriteY = -1;
		if (rmy > 0) {
			nspriteY = 0;
		}
		if (rmy < 0) {
			nspriteY = 3;
		}
		if (rmx > 0) {
			nspriteY = 2;
		}
		if (rmx < 0) {
			nspriteY = 1;
		}
	
		pl.spriteTime += delta;
		if (nspriteY != p.spriteY || !pl.moving) {
			pl.spriteTime = 0;
			if (nspriteY != -1) {
				p.spriteY = nspriteY;
				pl.spriteX = 0;
				pl.moving = true;
			} else {
				pl.spriteX = 1;
				pl.moving = false;
			}
		}
		if (pl.spriteTime >= 100) {
			pl.spriteTime -= 100;
			pl.spriteX = (pl.spriteX + 1) % 3;
		}
	}
}

// draw everything
function draw() {
	// background
	for (var i = 0; i < map.length; i++) {
		for (var j = 0; j < map[i].length; j++) {
			ctx.drawImage(blocks, 100, 0, 50, 50, j * 50, i * 50, 50, 50);
		}
	}
	
	// "3d" part of walls
	for (var i = 0; i < map.length; i++) {
		for (var j = 0; j < map[i].length; j++) {
			if (map[i][j] == 1 || map[i][j] == 2) {
				ctx.drawImage(blocks, 100 - map[i][j] * 50, 50, 50, 19, j * 50, i * 50 + 40, 50, 19);
			}
		}
	}
	
	// bombs
	for (var id in bombs) {
		var b = bombs[id];
		ctx.drawImage(muffin, b.x * 50 + 5, b.y * 50 - 5);
	}
	
	// players
	for (var id in players) if (players[id].playing) {
		var p = players[id], pl = players_local[id];
		ctx.drawImage(sprites, ((p.pony % 4) * 3 + pl.spriteX) * 64, (Math.floor(p.pony / 4) * 4 + p.spriteY) * 64, 64, 64, p.x - 7, p.y - 20, 64, 64);
	}
	
	// walls, muffins and powerups
	for (var i = 0; i < map.length; i++) {
		for (var j = 0; j < map[i].length; j++) {
			if (map[i][j] == 1 || map[i][j] == 2) {
				ctx.drawImage(blocks, 100 - map[i][j] * 50, 0, 50, 50, j * 50, i * 50 - 10, 50, 50);
			}
			if (map[i][j] == -2) {
				ctx.lineWidth = 0;
				ctx.fillStyle = 'cyan';
				ctx.fillRect(j * 50, i * 50 - 10, 50, 50);
			}
			if (map[i][j] == -3) {
				ctx.lineWidth = 0;
				ctx.fillStyle = 'red';
				ctx.fillRect(j * 50, i * 50 - 10, 50, 50);
			}
		}
	}
}

var last_timestamp = Date.now();
function loop(timestamp) {
	var timedelta = Math.floor(timestamp - last_timestamp);
	last_timestamp += timedelta;
	
	ctx.clearRect(0, 0, width, height);
	update(timedelta);
	draw();
	
	var rposx = Math.floor((players[myid].x + 25) / 50);
	var rposy = Math.floor((players[myid].y + 25) / 50);
	if (map[rposy][rposx] == -3) {
		socket.emit('pickup', {x: rposx, y: rposy});
	}
	
	requestAnimFrame(loop);
}

var fileref = document.createElement('script');
fileref.setAttribute('type', 'text/javascript');
fileref.setAttribute('src', 'http://' + window.location.hostname + ':1380/socket.io/socket.io.js');
document.getElementsByTagName("head")[0].appendChild(fileref);
fileref.onload = function() {
	$(document).ready(function() {
		canvas = document.getElementById('canvas');
		ctx = canvas.getContext('2d');
	
		sprites = new Image();
		sprites.src = 'ponies.png';
		blocks = new Image();
		blocks.src = 'blocks.png';
		muffin = new Image();
		muffin.src = 'muffin.png';
	
		socket = io.connect('http://' + window.location.hostname + ':1380');
		socket.on('hello', function(data) {
			players = data.players;
			players_local = {};
			bombs = data.bombs;
			map = data.map;
			myid = data.id;
			timeleft = data.timeleft;
		
			$('#players').html('');
			for (var id in players) {
				$('#players').append('<div id="user-' + id + '" class="list-element">' + players[id].name + '<div>');
			}
		
			$('#name').val(data.name);
			$('#pony').val(data.pony);
		
			requestAnimFrame(loop);
		});
		socket.on('game', function(data) {
			players = data.players;
			players_local = {};
			map = data.map;
			bombs = {};
			timeleft = data.timeleft;
		
			requestAnimFrame(loop);
		});
	
		socket.on('joined', function(data) {
			players[data.id] = data.data;
			$('#players').append('<div id="user-' + data.id + '" class="list-element">' + data.data.name + '<div>');
		});
		socket.on('gone', function(data) {
			$('#user-' + data.id).remove();
			delete players[data.id];
			delete players_local[data.id];
		});
		socket.on('rename', function(data) {
			$('#user-' + data.id).html(data.name);
			players[data.id].pony = data.pony;
		});

		$(document).keydown(function(e) {
			if (e.keyCode >= 37 && e.keyCode <= 40 && !players[myid].keys[e.keyCode - 37]) {
				players[myid].keys[e.keyCode - 37] = true;
				socket.emit('move', players[myid]);
			}
		
			if (e.keyCode == 32) {
				socket.emit('plant', {x: Math.floor((players[myid].x + 25) / 50), y: Math.floor((players[myid].y + 25) / 50), player: myid});
			}
		});
		$(document).keyup(function(e) {
			if (e.keyCode >= 37 && e.keyCode <= 40) {
				players[myid].keys[e.keyCode - 37] = false;
				socket.emit('move', players[myid]);
			}
		});
	
		function rename() {
			socket.emit('rename', {name: $('#name').val(), pony: $('#pony').val()});
		}
		$('#name').change(rename);
		$('#pony').change(rename);
	
		// position update
		socket.on('move', function(data) {
			if (data.id != myid) {
				players[data.id] = data.data;
			} else {
				players[data.id].playing = data.data.playing;
			}
		});
	
		// map update
		socket.on('map', function(data) {
			map = data;
		});
	
		// flame update
		socket.on('flame', function(data) {
			players[data.id].flame = data.flame;
		});
	
		// bomb updates
		socket.on('plant', function(data) {
			bombs[data.id] = data.data;
			map[data.data.y][data.data.x] = 100;
		});
		socket.on('boom', function(data) {
			map[bombs[data.id].y][bombs[data.id].x] = 0;
			delete bombs[data.id];
		});
	});
};
