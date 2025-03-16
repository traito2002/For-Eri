Math.TAU = Math.PI * 2;

///// LOAD IMAGES /////

var assetsCallback;
var onLoadAssets = function (callback) {
	assetsCallback = callback;
	if (assetsLeft == 0) assetsCallback();
};
var assetsLeft = 0;
var onAssetLoaded = function () {
	assetsLeft--;
	if (assetsLeft == 0) assetsCallback();
};
var images = {};
function addAsset(name, src) {
	assetsLeft++;
	images[name] = new Image();
	images[name].onload = onAssetLoaded;
	images[name].src = src;
}
function addSound(name, src) {
	assetsLeft++;
	createjs.Sound.addEventListener("fileload", onAssetLoaded);
	createjs.Sound.registerSound({ src: src, id: name });
}

//////////////

function Level(config, isIntro) {

	var self = this;
	self.isIntro = isIntro;

	self.circles = config.circles;
	self.player = new Peep(config.player, self);
	self.key = new DoorKey(config.key, self);
	self.door = new Door(config.door, self);
	self.clock = new Clock(config.countdown, self);

	self.canvas = config.canvas;
	self.ctx = self.canvas.getContext('2d');
	self.width = self.canvas.width;

	if (self.isIntro) {
		self.height = self.canvas.height;
	} else {
		self.height = self.canvas.height - 80;
	}

	self.pathCanvas = document.createElement("canvas");
	self.pathCanvas.width = self.width;
	self.pathCanvas.height = self.height;
	self.pathContext = self.pathCanvas.getContext('2d');
	self.DRAW_PATH = false;

	self.keyCollected = false;
	self.update = function () {

		self.player.update();
		self.key.update();

		var output = self.door.update();
		if (self.isIntro) {
			STAGE = 1;
		} else {
			if (output == "END_LEVEL") {
				self.ctx.clearRect(0, self.height, self.canvas.width, 80);
			} else {
				self.clock.update();
			}
			self.recordFrame();
		}

	};

	self.drawPathLastPoint = null;
	self.draw = function () {

		var ctx = self.ctx;

		// BIGGER EVERYTHING
		if (self.isIntro) {
			ctx.save();
			var introScale = 2;
			ctx.scale(introScale, introScale);
			ctx.translate(-self.width / 2, -self.height / 2);
			ctx.translate((self.width / 2) / introScale, (self.height / 2) / introScale);
		}

		// Clear
		if (self.isIntro) {
			ctx.clearRect(self.player.x - 100, self.player.y - 100, 200, 200);
			ctx.clearRect(self.key.x - 100, self.key.y - 100, 200, 200);
			ctx.clearRect(self.door.x - 100, self.door.y - 100, 200, 200);
		} else {
			ctx.fillStyle = "#fff";
			ctx.fillRect(0, 0, self.width, self.height);
		}

		// Draw shadows
		var objects = [self.player, self.key, self.door];
		for (var i = 0; i < objects.length; i++) {
			objects[i].drawShadow(ctx);
		}

		// Draw circles
		ctx.fillStyle = '#333';
		for (var i = 0; i < self.circles.length; i++) {
			var c = self.circles[i];
			if (c.invisible) continue;
			ctx.beginPath();
			ctx.arc(c.x, c.y, c.radius, 0, Math.TAU, false);
			ctx.fill();
		}

		// Draw Peep, Key, Door in depth
		objects.sort(function (a, b) { return a.y - b.y; });
		for (var i = 0; i < objects.length; i++) {
			objects[i].draw(ctx);
		}

		// Draw path?
		if (self.DRAW_PATH) {
			ctx.drawImage(self.pathCanvas, 0, 0);

			if (!self.drawPathLastPoint) {
				self.drawPathLastPoint = {
					x: self.player.x - 0.1,
					y: self.player.y
				};
			}

			var pctx = self.pathContext;
			pctx.beginPath();
			pctx.strokeStyle = "#cc2727";
			pctx.lineWidth = 20;
			pctx.lineCap = "round";
			pctx.lineJoin = "round";
			pctx.moveTo(self.drawPathLastPoint.x, self.drawPathLastPoint.y);
			pctx.lineTo(self.player.x, self.player.y);
			pctx.stroke();

			self.drawPathLastPoint = {
				x: self.player.x,
				y: self.player.y
			};

		}

		// CLOCK
		if (self.isIntro) {
		} else {
			ctx.clearRect(0, self.height, self.canvas.width, 80);
			if (!self.NO_CLOCK) self.clock.draw(ctx);
		}

		// BIGGER EVERYTHING
		if (self.isIntro) {
			ctx.restore();
		}

	};

	self.frames = [];
	self.recordFrame = function () {

		var frame = {
			player: {
				x: self.player.x,
				y: self.player.y,
				sway: self.player.sway,
				bounce: self.player.bounce,
				frame: self.player.frame,
				direction: self.player.direction
			},
			key: {
				hover: self.key.hover
			},
			door: {
				frame: self.door.frame
			},
			keyCollected: self.keyCollected
		};

		self.frames.push(frame);

	}

	var lastCollected = false;
	self.playbackFrame = function (frameIndex) {

		var frame = self.frames[frameIndex];

		self.player.x = frame.player.x;
		self.player.y = frame.player.y;
		self.player.sway = frame.player.sway;
		self.player.bounce = frame.player.bounce;
		self.player.frame = frame.player.frame;
		self.player.direction = frame.player.direction;

		self.key.hover = frame.key.hover;
		self.door.frame = frame.door.frame;

		self.keyCollected = frame.keyCollected;
		if (self.keyCollected && !lastCollected && STAGE == 3) {
			createjs.Sound.play("unlock");
		}
		lastCollected = self.keyCollected;

		self.NO_CLOCK = true;
		self.draw();

	}

	self.clear = function () {
		var ctx = self.ctx;
		ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
	}

	self.onlyPath = function () {
		self.clear();
		self.ctx.drawImage(self.pathCanvas, 0, 0);
	}

}

//////////////

function Clock(countdown, level) {

	var self = this;
	self.level = level;
	self.framePerTick = 30 / countdown;

	var enterSide = null;
	var exitSide = null;

	self.update = function () {

		// THIS IS TOTALLY A HACK, JUST FOR LEVEL 2
		// SUBTLY CHEAT - IT'S IMPOSSIBLE TO SOLVE IT THE WRONG WAY

		if (CURRENT_LEVEL == 1) {
			if (level.keyCollected) {
				if (!exitSide && Math.abs(level.player.x - 150) > 30) {
					exitSide = (level.player.x < 150) ? "left" : "right";
				}
			} else {
				if (!enterSide && level.player.y < 150) {
					enterSide = (level.player.x < 150) ? "left" : "right";
				}
			}
			if (exitSide && enterSide) {
				if (exitSide == enterSide) {
					self.frame += self.framePerTick * 1.8;
				}
			}
		}

		// Normal update

		self.frame += self.framePerTick;
		if (self.frame >= 30) {
			createjs.Sound.play("error");
			reset();
		}

	};

	self.frame = 0;
	self.draw = function (ctx) {

		ctx.save();
		ctx.translate(level.width / 2, level.height + 40);

		var f = Math.floor(self.frame);
		var sw = 82;
		var sh = 82;
		var sx = (f * sw) % images.clock.width;
		var sy = sh * Math.floor((f * sw) / images.clock.width);
		ctx.drawImage(images.clock, sx, sy, sw, sh, -30, -30, 60, 60);
		ctx.restore();

	};

}

function DoorKey(config, level) {

	var self = this;
	self.level = level;

	self.x = config.x;
	self.y = config.y;

	self.hover = 0;
	self.update = function () {

		if (level.keyCollected) return;

		self.hover += 0.07;

		var dx = self.x - level.player.x;
		var dy = self.y - level.player.y;
		var distance = Math.sqrt(dx * dx / 4 + dy * dy);
		if (distance < 15) {
			level.keyCollected = true;

			createjs.Sound.play("unlock");

		}

	};

	self.draw = function (ctx) {

		if (level.keyCollected) return;

		ctx.save();
		ctx.translate(self.x, self.y - 20 - Math.sin(self.hover) * 5);
		ctx.scale(0.5, 0.5);
		ctx.drawImage(images.key, -25, -100, 50, 100);
		// ctx.drawImage(images.peep, -25, -100, 50, 100);
		ctx.restore();

	};
	self.drawShadow = function (ctx) {

		if (level.keyCollected) return;

		ctx.save();
		ctx.translate(self.x, self.y);
		ctx.scale(0.7, 0.7);

		var scale = 1 - Math.sin(self.hover) * 0.5;
		ctx.scale(1 * scale, 0.3 * scale);
		ctx.beginPath();
		ctx.arc(0, 0, 15, 0, Math.TAU, false);
		ctx.fillStyle = 'rgba(100,100,100,0.4)';
		ctx.fill();
		ctx.restore();

	};

}

function Door(config, level) {

	var self = this;
	self.level = level;

	self.x = config.x;
	self.y = config.y;

	self.update = function () {

		if (level.keyCollected && self.frame < 10) {
			self.frame += 0.5;
		}

		if (level.keyCollected) {
			var dx = self.x - level.player.x;
			var dy = self.y - level.player.y;
			var distance = Math.sqrt(dx * dx / 25 + dy * dy);
			if (distance < 8) {
				if (level.isIntro) {

					document.getElementById("whole_container").style.top = "-100%";

					createjs.Sound.play("ding");

					CURRENT_LEVEL = 0;
					var lvl = new Level(LEVEL_CONFIG[CURRENT_LEVEL]);
					levelObjects[CURRENT_LEVEL] = lvl;
					window.level = null;
					setTimeout(function () {
						window.level = lvl;
					}, 1200);

					return "END_LEVEL";
				} else {
					next();
					return "END_LEVEL";
				}
			}
		}

	};

	self.frame = 0;
	self.draw = function (ctx) {

		ctx.save();
		ctx.translate(self.x, self.y);
		ctx.scale(0.7, 0.7);

		var f = Math.floor(self.frame);
		var sw = 68;
		var sh = 96;
		var sx = (f * sw) % images.door.width;
		var sy = sh * Math.floor((f * sw) / images.door.width);
		var dx = -34;
		var dy = -91;
		ctx.drawImage(images.door, sx, sy, sw, sh, dx, dy, sw, sh);
		ctx.restore();

	};
	self.drawShadow = function (ctx) {

		ctx.save();
		ctx.translate(self.x, self.y);
		ctx.scale(0.7, 0.7);
		ctx.scale(1, 0.2);
		ctx.beginPath();
		ctx.arc(0, 0, 30, 0, Math.TAU, false);
		ctx.fillStyle = 'rgba(100,100,100,0.4)';
		ctx.fill();
		ctx.restore();

	};

}

//////////////

function Peep(config, level) {

	var self = this;
	self.level = level;

	self.x = config.x;
	self.y = config.y;
	self.vel = { x: 0, y: 0 };
	self.frame = 0;
	self.direction = 1;

	self.update = function () {

		// Keyboard

		var dx = 0;
		var dy = 0;

		if (Key.left) dx -= 1;
		if (Key.right) dx += 1;
		if (Key.up) dy -= 1;
		if (Key.down) dy += 1;

		var dd = Math.sqrt(dx * dx + dy * dy);
		if (dd > 0) {
			self.vel.x += (dx / dd) * 2;
			self.vel.y += (dy / dd) * 2;
		}

		if (Key.left) self.direction = -1;
		if (Key.right) self.direction = 1;

		if (Key.left || Key.right || Key.up || Key.down) {
			//if(self.frame==0) bounce=0.8;
			self.frame++;
			if (self.frame > 9) self.frame = 1;
		} else {
			if (self.frame > 0) self.bounce = 0.8;
			self.frame = 0;
		}

		// Velocity

		self.x += self.vel.x;
		self.y += self.vel.y;
		self.vel.x *= 0.7;
		self.vel.y *= 0.7;

		// Dealing with colliding into border
		if (self.x < 0) self.x = 0;
		if (self.y < 0) self.y = 0;
		if (self.x > level.width) self.x = level.width;
		if (self.y > level.height) self.y = level.height;

		// Dealing with collision of circles
		// Hit a circle? Figure out how deep, then add that vector away from the circle.

		for (var i = 0; i < level.circles.length; i++) {

			var circle = level.circles[i];

			// Hit circle?
			var dx = self.x - circle.x;
			var dy = self.y - circle.y;
			var distance = Math.sqrt(dx * dx + dy * dy);
			var overlap = (circle.radius + 5) - distance;
			if (overlap > 0) {

				// Yes, I've been hit, by "overlap" pixels.
				// Push me back
				var ux = dx / distance;
				var uy = dy / distance;
				var pushX = ux * overlap;
				var pushY = uy * overlap;
				self.x += pushX;
				self.y += pushY;

			}

		}

		// Bouncy & Sway
		self.sway += swayVel;
		swayVel += ((-self.vel.x * 0.08) - self.sway) * 0.2;
		swayVel *= 0.9;
		self.bounce += bounceVel;
		bounceVel += (1 - self.bounce) * 0.2;
		bounceVel *= 0.9;

	};

	self.bounce = 1;
	var bounceVel = 0;
	self.sway = 0;
	var swayVel = 0;
	var bouncy = [0.00, 0.25, 1.00, 0.90, 0.00, 0.00, 0.25, 1.00, 0.90, 0.00];
	self.draw = function (ctx) {

		var x = self.x;
		var y = self.y;

		// DRAW GOOFY BOUNCY DUDE //

		y += -6 * bouncy[self.frame];

		if (self.frame == 4 || self.frame == 9) {
			createjs.Sound.play("step", { volume: 0.5 });
		}

		ctx.save();
		ctx.translate(x, y);
		ctx.scale(0.5, 0.5);

		ctx.rotate(self.sway);
		ctx.scale(self.direction, 1);///anim.stretch, anim.stretch);
		ctx.scale(1 / self.bounce, self.bounce);
		//ctx.rotate(anim.rotate*0.15);
		ctx.drawImage(images.peep, -25, -100, 50, 100);
		ctx.restore();

	};

	self.drawShadow = function (ctx) {

		var x = self.x;
		var y = self.y;

		ctx.save();
		ctx.translate(x, y);
		ctx.scale(0.5, 0.5);

		var scale = (3 - bouncy[self.frame]) / 3;
		ctx.scale(1 * scale, 0.3 * scale);
		ctx.beginPath();
		ctx.arc(0, 0, 20, 0, Math.TAU, false);
		ctx.fillStyle = 'rgba(100,100,100,0.4)';
		ctx.fill();
		ctx.restore();

	};

}

//// UPDATE & RENDER ////

window.requestAnimFrame = window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	function (callback) { window.setTimeout(callback, 1000 / 60); };

window.onload = function () {

	addAsset("peep", "assets/2.png");
	addAsset("key", "assets/1.png");
	addAsset("door", "assets/door.png");
	addAsset("clock", "assets/clock.png");

	createjs.Sound.alternateExtensions = ["ogg"];
	addSound("ding", "audio/ding.mp3");
	addSound("rewind", "audio/rewind.mp3");
	addSound("jazz", "audio/this.mp3");
	addSound("step", "audio/step.mp3");
	addSound("unlock", "audio/unlock.mp3");
	addSound("error", "audio/error.mp3");

	onLoadAssets(function () {

		window.setTimeout(function () {
			document.getElementById("loading").style.display = "none";
		}, 300);

		window.level = new Level(window.INTRO_LEVEL, true);

		//////////

		var frameDirty = false;
		function update() {

			if (STAGE == 0 || STAGE == 1) {
				if (level) {
					level.update();
					frameDirty = true;
				}
			} else if (STAGE == 2 || STAGE == 3) {
				frameDirty = true;
			}

			if (STAGE == 3 && !window.HAS_PLAYED_JAZZ && CURRENT_LEVEL == 4) {
						window.HAS_PLAYED_JAZZ = true;
						createjs.Sound.play("jazz");

			}

		}
		function render() {

			if (STAGE == 0 || STAGE == 1) {

				if (level) {
					level.draw();
				}

				frameDirty = false;

			} else if (STAGE == 2) {

				rewindLevel.playbackFrame(rewindFrame);
				rewindFrame--;
				if (rewindFrame < 0) {
					CURRENT_LEVEL--;
					if (CURRENT_LEVEL >= 0) {
						startRewind();
					} else {
						STAGE = 3;
						CURRENT_LEVEL = 0;
						startPlayback();

						document.getElementById("rewind_text").style.display = 'none';
						document.getElementById("replay_text").style.display = "block";

					}
				}

			} else if (STAGE == 3) {

				rewindLevel.playbackFrame(rewindFrame);
				rewindFrame++;
				if (rewindFrame >= rewindLevel.frames.length) {
					CURRENT_LEVEL++;
					if (CURRENT_LEVEL < 5) {
						startPlayback();
					} else {

						document.getElementById("replay_text").style.display = "none";
						iHeartYou();
						STAGE = 4;

					}
				}

				frameDirty = false;

			}

		}

		setInterval(update, 1000 / 30);
		(function animloop() {
			requestAnimFrame(animloop);
			if (frameDirty) render();
		})();

	});

};

var STAGE = 0;
// 0 - Intro
// 1 - Play levels in order
// 2 - Rewind levels
// 3 - Replay levels with path
// 4 - I HEART YOU
// 5 - End screen

function next() {
	CURRENT_LEVEL++;
	if (CURRENT_LEVEL < LEVEL_CONFIG.length) {

		createjs.Sound.play("ding");

		var lvl = new Level(LEVEL_CONFIG[CURRENT_LEVEL]);
		levelObjects[CURRENT_LEVEL] = lvl;
		window.level = null;
		setTimeout(function () {
			window.level = lvl;
		}, 500);

	} else {
		level = null;
		STAGE = 2;
		CURRENT_LEVEL = 3;
		startRewind();


		var totalFrames = levelObjects[0].frames.length + levelObjects[1].frames.length + levelObjects[2].frames.length;
		var totalRewindTime = totalFrames / 60;
		var extraTime = 6600 - totalRewindTime * 1000;
		if (extraTime < 0) {
			createjs.Sound.play("rewind");
		} else {
			createjs.Sound.play("rewind", "none", 0, extraTime);
		}

		document.getElementById("rewind_text").style.display = 'block';

	}
}

function iHeartYou() {

	for (var i = 0; i < levelObjects.length; i++) {
		levelObjects[i].onlyPath();
	}

	document.getElementById("canvas_container").style.backgroundPosition = "0px -390px";
	document.getElementById("screen_two").style.background = "#000";

	var can_cont_text = document.getElementById("canvas_container_text");

	var vtext = document.getElementById("valentines_text");
	vtext.style.display = "block";
	if (window.location.hash) {
		vtext.textContent = encryptString(decodeURIComponent(window.location.hash).substring(1));
	} else {
		vtext.textContent = "";
	}

	setTimeout(function () {
		vtext.style.letterSpacing = "3px";
	}, 10);

	// After 9 seconds, swipe down to CREDITS.
	// No replay. Fuck it.
	setTimeout(function () {
		document.getElementById("whole_container").style.top = "-200%";
	}, 8500);
	setTimeout(function () {
		yourMessage.focus();
	}, 8500);

}

var rewindFrame = 0;
var rewindLevel = null;
function startRewind() {
	rewindLevel = levelObjects[CURRENT_LEVEL];
	rewindFrame = rewindLevel.frames.length - 1;
}
function startPlayback() {
	rewindLevel = levelObjects[CURRENT_LEVEL];
	rewindLevel.DRAW_PATH = true;
	rewindFrame = 0;
}

var levelObjects = [];
var CURRENT_LEVEL = 0;
function reset() {
	var lvl = new Level(LEVEL_CONFIG[CURRENT_LEVEL]);
	levelObjects[CURRENT_LEVEL] = lvl;
	if (window.level) window.level.clear();
	window.level = null;
	setTimeout(function () {
		window.level = lvl;
	}, 500);
}

///////////////////////////////////////////////////////////////////

// Simple XOR encryption (key = 1)
// The only purpose is to obscure it in the hash

function encryptString(string) {
	var result = "";
	for (var i = 0; i < string.length; i++) {
		result += String.fromCharCode(string.charCodeAt(i) ^ 1);
	}
	return result;
}
function decryptString(string) {
	return encryptString(string); // it's XOR, duh
}




///////////////////////////////////////////////////////////////////


var introCanvas = document.getElementById("canvas_intro");
introCanvas.width = window.innerWidth;
introCanvas.height = window.innerHeight;
var cx = window.innerWidth / 2;
var cy = window.innerHeight / 2;

window.INTRO_LEVEL = {

	canvas: document.getElementById("canvas_intro"),
	// player:{ x:cx-150, y:cy-30 },
	// door:{ x:cx+150, y:cy-30 },  real 
	// key:{ x:cx, y:cy+125 },
	player: { x: cx - 150, y: cy - 30 },
	door: { x: cx - 150, y: cy - 30 },
	key: { x: cx - 150, y: cy - 30 },
	circles: [
		{ x: cx, y: cy, radius: 120, invisible: true }
	]

};

window.LEVEL_CONFIG = [
	// I
	{
		canvas:document.getElementById("canvas_1"),
		player:{ x:150, y:170 },
		door:{ x:150, y:60 },
		key:{ x:150, y:275 },
		circles: [
			{x:0,y:150,radius:100},
			{x:300,y:150,radius:100}
		],
		countdown: 100
	},
		// HEART
		{
			canvas:document.getElementById("canvas_2"),
			player:{ x:150, y:250 },
			door:{ x:150, y:249 },
			key:{ x:150, y:75 },
			circles: [
				{x:100,y:100,radius:50},
				{x:200,y:100,radius:50},
				{x:150,y:100,radius:10,invisible:true},
				{x:0,y:300,radius:145},
				{x:300,y:300,radius:145}
			],
			// SUPER HACK - for level 2, change timer so it's impossible to beat if you go BACKWARDS.
			countdown: 200
		},
	// E
	{
		canvas: document.getElementById("canvas_3"),
		player: { x: 170, y: 75 },
		door: { x: 250, y: 290 },
		key: { x: 220, y: 150 },
		circles: [
			{ x: 150, y: 90, radius: 50 },
			{ x: 150, y: 210, radius: 50 },
			{ x: 152, y: 90, radius: 50 },
			{ x: 152, y: 210, radius: 50 },
			{ x: 154, y: 90, radius: 50 },
			{ x: 154, y: 210, radius: 50 },
			{ x: 156, y: 90, radius: 50 },
			{ x: 156, y: 210, radius: 50 },
			{ x: 158, y: 90, radius: 50 },
			{ x: 158, y: 210, radius: 50 },
			{ x: 160, y: 90, radius: 50 },
			{ x: 160, y: 210, radius: 50 },
			{ x: 162, y: 90, radius: 50 },
			{ x: 162, y: 210, radius: 50 },
			{ x: 164, y: 90, radius: 50 },
			{ x: 164, y: 210, radius: 50 },
			{ x: 166, y: 90, radius: 50 },
			{ x: 166, y: 210, radius: 50 },
			{ x: 168, y: 90, radius: 50 },
			{ x: 168, y: 210, radius: 50 },
			{ x: 170, y: 90, radius: 50 },
			{ x: 170, y: 210, radius: 50 },
			{ x: 172, y: 90, radius: 50 },
			{ x: 172, y: 210, radius: 50 },
			{ x: 174, y: 90, radius: 50 },
			{ x: 174, y: 210, radius: 50 },
			{ x: 176, y: 90, radius: 50 },
			{ x: 176, y: 210, radius: 50 },
			{ x: 178, y: 90, radius: 50 },
			{ x: 178, y: 210, radius: 50 },
			{ x: 180, y: 90, radius: 50 },
			{ x: 180, y: 210, radius: 50 },
			{ x: 182, y: 90, radius: 50 },
			{ x: 182, y: 210, radius: 50 },
			{ x: 184, y: 90, radius: 50 },
			{ x: 184, y: 210, radius: 50 },
			{ x: 186, y: 90, radius: 50 },
			{ x: 186, y: 210, radius: 50 },
			{ x: 188, y: 90, radius: 50 },
			{ x: 188, y: 210, radius: 50 },
			{ x: 190, y: 90, radius: 50 },
			{ x: 190, y: 210, radius: 50 },
			{ x: 192, y: 90, radius: 50 },
			{ x: 192, y: 210, radius: 50 },
			{ x: 194, y: 90, radius: 50 },
			{ x: 194, y: 210, radius: 50 },
			{ x: 196, y: 90, radius: 50 },
			{ x: 196, y: 210, radius: 50 },
			{ x: 198, y: 90, radius: 50 },
			{ x: 198, y: 210, radius: 50 },
			{ x: 200, y: 90, radius: 50 },
			{ x: 200, y: 210, radius: 50 },
			{ x: 202, y: 90, radius: 50 },
			{ x: 202, y: 210, radius: 50 },
			{ x: 204, y: 90, radius: 50 },
			{ x: 204, y: 210, radius: 50 },
			{ x: 206, y: 90, radius: 50 },
			{ x: 206, y: 210, radius: 50 },
			{ x: 208, y: 90, radius: 50 },
			{ x: 208, y: 210, radius: 50 },
			{ x: 210, y: 90, radius: 50 },
			{ x: 210, y: 210, radius: 50 },
			{ x: 212, y: 90, radius: 50 },
			{ x: 212, y: 210, radius: 50 },
			{ x: 214, y: 90, radius: 50 },
			{ x: 214, y: 210, radius: 50 },
			{ x: 216, y: 90, radius: 50 },
			{ x: 216, y: 210, radius: 50 },
			{ x: 218, y: 90, radius: 50 },
			{ x: 218, y: 210, radius: 50 },
			{ x: 220, y: 90, radius: 50 },
			{ x: 220, y: 210, radius: 50 },
			{ x: 222, y: 90, radius: 50 },
			{ x: 222, y: 210, radius: 50 },
			{ x: 224, y: 90, radius: 50 },
			{ x: 224, y: 210, radius: 50 },
			{ x: 226, y: 90, radius: 50 },
			{ x: 226, y: 210, radius: 50 },
			{ x: 228, y: 90, radius: 50 },
			{ x: 228, y: 210, radius: 50 },
			{ x: 250, y: 90, radius: 50 },
			{ x: 250, y: 210, radius: 50 },
			{ x: 232, y: 90, radius: 50 },
			{ x: 232, y: 210, radius: 50 },
			{ x: 234, y: 90, radius: 50 },
			{ x: 234, y: 210, radius: 50 },
			{ x: 236, y: 90, radius: 50 },
			{ x: 236, y: 210, radius: 50 },
			{ x: 238, y: 90, radius: 50 },
			{ x: 238, y: 210, radius: 50 },
			{ x: 240, y: 90, radius: 50 },
			{ x: 240, y: 210, radius: 50 },
			{ x: 242, y: 90, radius: 50 },
			{ x: 242, y: 210, radius: 50 },
			{ x: 244, y: 90, radius: 50 },
			{ x: 244, y: 210, radius: 50 },
			{ x: 246, y: 90, radius: 50 },
			{ x: 246, y: 210, radius: 50 },
			{ x: 248, y: 90, radius: 50 },
			{ x: 248, y: 210, radius: 50 },
			{ x: 250, y: 90, radius: 50 },
			{ x: 250, y: 210, radius: 50 },
			{ x: 252, y: 90, radius: 50 },
			{ x: 252, y: 210, radius: 50 },
			{ x: 254, y: 90, radius: 50 },
			{ x: 254, y: 210, radius: 50 },
			{ x: 256, y: 90, radius: 50 },
			{ x: 256, y: 210, radius: 50 },
			{ x: 258, y: 90, radius: 50 },
			{ x: 258, y: 210, radius: 50 },
			{ x: 260, y: 90, radius: 50 },
			{ x: 260, y: 210, radius: 50 },
			{ x: 262, y: 90, radius: 50 },
			{ x: 262, y: 210, radius: 50 },
			{ x: 264, y: 90, radius: 50 },
			{ x: 264, y: 210, radius: 50 },
			{ x: 266, y: 90, radius: 50 },
			{ x: 266, y: 210, radius: 50 },
			{ x: 268, y: 90, radius: 50 },
			{ x: 268, y: 210, radius: 50 },
			{ x: 270, y: 90, radius: 50 },
			{ x: 270, y: 210, radius: 50 },
			{ x: 272, y: 90, radius: 50 },
			{ x: 272, y: 210, radius: 50 },
			{ x: 274, y: 90, radius: 50 },
			{ x: 274, y: 210, radius: 50 },
			{ x: 276, y: 90, radius: 50 },
			{ x: 276, y: 210, radius: 50 },
			{ x: 278, y: 90, radius: 50 },
			{ x: 278, y: 210, radius: 50 },
			{ x: 280, y: 90, radius: 50 },
			{ x: 280, y: 210, radius: 50 },
			{ x: 282, y: 90, radius: 50 },
			{ x: 282, y: 210, radius: 50 },
			{ x: 284, y: 90, radius: 50 },
			{ x: 284, y: 210, radius: 50 },
			{ x: 286, y: 90, radius: 50 },
			{ x: 286, y: 210, radius: 50 },
			{ x: 288, y: 90, radius: 50 },
			{ x: 288, y: 210, radius: 50 },
			{ x: 290, y: 90, radius: 50 },
			{ x: 290, y: 210, radius: 50 },
			{ x: 292, y: 90, radius: 50 },
			{ x: 292, y: 210, radius: 50 },
			{ x: 294, y: 90, radius: 50 },
			{ x: 294, y: 210, radius: 50 },
			{ x: 296, y: 90, radius: 50 },
			{ x: 296, y: 210, radius: 50 },
			{ x: 298, y: 90, radius: 50 },
			{ x: 298, y: 210, radius: 50 },
			{ x: 500, y: 90, radius: 50 },
			{ x: 500, y: 210, radius: 50 }


		],
		// SUPER HACK - for level 2, change timer so it's impossible to beat if you go BACKWARDS.
		// countdown: 200
		countdown: 200
	},
	//R
	{
		canvas: document.getElementById("canvas_4"),
		player: { x: 120, y: 280 },
		door: { x: 250, y: 300 },
		key: { x: 230, y: 75 },
		circles: [
			{ x: 170, y: 75, radius: 30 },// hinh tron tam
			{ x: 190, y: 75, radius: 30, invisible: true },
			{ x: 210, y: 75, radius: 30, invisible: true } ,
			//
			{ x: 150, y: 230, radius: 10 },// duoi xong xuong
			{ x: 155, y: 235, radius: 10 },
			{ x: 160, y: 240, radius: 10 },
			{ x: 165, y: 245, radius: 10 },
			{ x: 170, y: 250, radius: 10 },
			{ x: 175, y: 255, radius: 10 },
			{ x: 180, y: 260, radius: 10 },
			{ x: 185, y: 265, radius: 10 },
			{ x: 190, y: 270, radius: 10 },
			{ x: 195, y: 275, radius: 10 },
			{ x: 200, y: 280, radius: 10 },
			{ x: 205, y: 285, radius: 10 },
			{ x: 210, y: 290, radius: 10 },
			{ x: 215, y: 295, radius: 10 },
			{ x: 220, y: 300, radius: 10 },
			//
			{ x: 150, y: 230, radius: 10 },// duoi thang xuong
			{ x: 150, y: 232, radius: 10 },
			{ x: 150, y: 234, radius: 10 },
			{ x: 150, y: 236, radius: 10 },
			{ x: 150, y: 238, radius: 10 },
			{ x: 150, y: 240, radius: 10 },
			{ x: 150, y: 242, radius: 10 },
			{ x: 150, y: 244, radius: 10 },
			{ x: 150, y: 246, radius: 10 },
			{ x: 150, y: 248, radius: 10 },
			{ x: 150, y: 250, radius: 10 },
			{ x: 150, y: 252, radius: 10 },
			{ x: 150, y: 254, radius: 10 },
			{ x: 150, y: 256, radius: 10 },
			{ x: 150, y: 258, radius: 10 },
			{ x: 150, y: 260, radius: 10 },
			{ x: 150, y: 262, radius: 10 },
			{ x: 150, y: 264, radius: 10 },
			{ x: 150, y: 266, radius: 10 },
			{ x: 150, y: 268, radius: 10 },
			{ x: 150, y: 270, radius: 10 },
			{ x: 150, y: 272, radius: 10 },
			{ x: 150, y: 274, radius: 10 },
			{ x: 150, y: 276, radius: 10 },
			{ x: 150, y: 278, radius: 10 },
			{ x: 150, y: 280, radius: 10 },
			{ x: 150, y: 282, radius: 10 },
			{ x: 150, y: 284, radius: 10 },
			{ x: 150, y: 286, radius: 10 },
			{ x: 150, y: 288, radius: 10 },
			{ x: 150, y: 290, radius: 10 },
			{ x: 150, y: 292, radius: 10 },
			{ x: 150, y: 294, radius: 10 },
			{ x: 150, y: 296, radius: 10 },
			{ x: 150, y: 298, radius: 10 },
			{ x: 150, y: 300, radius: 10 },
			//
			{ x: 178, y: 290, radius: 30 },
			{ x: 170, y: 271, radius: 20 },// fill duoi
			
			//
			{ x: 150, y: 147, radius: 10 },// tren cong len
			{ x: 153, y: 146, radius: 10 },
			{ x: 156, y: 145, radius: 10 },
			{ x: 159, y: 144, radius: 10 },
			{ x: 162, y: 143, radius: 10 },
			{ x: 165, y: 142, radius: 10 },
			{ x: 168, y: 141, radius: 10 },
			{ x: 171, y: 140, radius: 10 },
			{ x: 174, y: 139, radius: 10 },
			{ x: 177, y: 138, radius: 10 },
			{ x: 180, y: 137, radius: 10 },
			{ x: 183, y: 136, radius: 10 },
			{ x: 186, y: 135, radius: 10 },
			{ x: 189, y: 134, radius: 10 },
			{ x: 192, y: 133, radius: 10 },
			{ x: 195, y: 132, radius: 10 },
			{ x: 198, y: 131, radius: 10 },
			{ x: 201, y: 130, radius: 10 },
			{ x: 204, y: 129, radius: 10 },
			{ x: 207, y: 128, radius: 10 },
			{ x: 210, y: 127, radius: 10 },
			{ x: 213, y: 126, radius: 10 },
			{ x: 216, y: 125, radius: 10 },
			{ x: 219, y: 124, radius: 10 },
			{ x: 222, y: 123, radius: 10 },
			{ x: 225, y: 122, radius: 10 },
			{ x: 228, y: 121, radius: 10 },
			{ x: 231, y: 120, radius: 10 },
			{ x: 234, y: 119, radius: 10 },
			{ x: 237, y: 118, radius: 10 },
			{ x: 240, y: 117, radius: 10 },
			{ x: 243, y: 116, radius: 10 },
			{ x: 246, y: 115, radius: 10 },
			{ x: 249, y: 114, radius: 10 },
			{ x: 252, y: 113, radius: 10 },
			{ x: 255, y: 112, radius: 10 },
			{ x: 258, y: 111, radius: 10 },
			{ x: 261, y: 110, radius: 10 },
			{ x: 264, y: 109, radius: 10 },
			{ x: 267, y: 108, radius: 10 },
			{ x: 270, y: 107, radius: 10 },
			{ x: 273, y: 106, radius: 10 },
			{ x: 276, y: 105, radius: 10 },
			{ x: 279, y: 104, radius: 10 },
			{ x: 282, y: 103, radius: 10 },
			{ x: 285, y: 102, radius: 10 },
			{ x: 288, y: 101, radius: 10 },
			{ x: 291, y: 100, radius: 10 },
			{ x: 294, y: 99, radius: 10 },
			{ x: 297, y: 98, radius: 10 },
			{ x: 300, y: 97, radius: 10 },
			//
			{ x: 150, y: 157, radius: 10 },// tren cong xuong
			{ x: 155, y: 162, radius: 10 },
			{ x: 160, y: 167, radius: 10 },
			{ x: 165, y: 172, radius: 10 },
			{ x: 170, y: 177, radius: 10 },
			{ x: 175, y: 182, radius: 10 },
			{ x: 180, y: 187, radius: 10 },
			{ x: 185, y: 192, radius: 10 },
			{ x: 190, y: 197, radius: 10 },
			{ x: 195, y: 202, radius: 10 },
			{ x: 200, y: 207, radius: 10 },
			{ x: 205, y: 212, radius: 10 },
			{ x: 210, y: 217, radius: 10 },
			{ x: 215, y: 222, radius: 10 },
			{ x: 220, y: 227, radius: 10 },
			{ x: 225, y: 232, radius: 10 },
			{ x: 230, y: 237, radius: 10 },
			{ x: 235, y: 242, radius: 10 },
			{ x: 240, y: 247, radius: 10 },
			{ x: 245, y: 252, radius: 10 },
			{ x: 250, y: 257, radius: 10 },
			{ x: 255, y: 262, radius: 10 },
			{ x: 260, y: 267, radius: 10 },
			{ x: 265, y: 272, radius: 10 },
			{ x: 270, y: 277, radius: 10 },
			{ x: 275, y: 282, radius: 10 },
			{ x: 280, y: 287, radius: 10 },
			{ x: 285, y: 292, radius: 10 },
			{ x: 290, y: 297, radius: 10 },
			{ x: 295, y: 302, radius: 10 },
			{ x: 300, y: 307, radius: 10 },
			//
			{ x: 150, y: 147, radius: 10 },//fill dau mau tren
			{ x: 150, y: 148, radius: 10 },
			{ x: 150, y: 149, radius: 10 },
			{ x: 150, y: 150, radius: 10 },
			{ x: 150, y: 151, radius: 10 },
			{ x: 150, y: 152, radius: 10 },
			{ x: 150, y: 153, radius: 10 },
			{ x: 150, y: 154, radius: 10 },
			{ x: 150, y: 155, radius: 10 },
			{ x: 150, y: 156, radius: 10 },
			//
			{ x: 225, y: 170, radius: 50 },// fill tren
			{ x: 250, y: 200, radius: 50 },
			{ x: 275, y: 230, radius: 50 },
			{ x: 300, y: 269, radius: 50 },
			{ x: 300, y: 150, radius: 50 },
			{ x: 280, y: 150, radius: 50 },
			{ x: 180, y: 160, radius: 25 },
			//
			{ x: 152, y: 10, radius: 15 },//le tren
			{ x: 154, y: 10, radius: 15 },
			{ x: 156, y: 10, radius: 15 },
			{ x: 158, y: 10, radius: 15 },
			{ x: 160, y: 10, radius: 15 },
			{ x: 162, y: 10, radius: 15 },
			{ x: 164, y: 10, radius: 15 },
			{ x: 166, y: 10, radius: 15 },
			{ x: 168, y: 10, radius: 15 },
			{ x: 170, y: 10, radius: 15 },
			{ x: 172, y: 10, radius: 15 },
			{ x: 174, y: 10, radius: 15 },
			{ x: 176, y: 10, radius: 15 },
			{ x: 178, y: 10, radius: 15 },
			{ x: 180, y: 10, radius: 15 },
			{ x: 182, y: 10, radius: 15 },
			{ x: 184, y: 10, radius: 15 },
			{ x: 186, y: 10, radius: 15 },
			{ x: 188, y: 10, radius: 15 },
			{ x: 190, y: 10, radius: 15 },
			{ x: 192, y: 10, radius: 15 },
			{ x: 194, y: 10, radius: 15 },
			{ x: 196, y: 10, radius: 15 },
			{ x: 198, y: 10, radius: 15 },
			{ x: 200, y: 10, radius: 15 },
			{ x: 202, y: 10, radius: 15 },
			{ x: 204, y: 10, radius: 15 },
			{ x: 206, y: 10, radius: 15 },
			{ x: 208, y: 10, radius: 15 },
			{ x: 210, y: 10, radius: 15 },
			{ x: 212, y: 10, radius: 15 },
			{ x: 214, y: 10, radius: 15 },
			{ x: 216, y: 10, radius: 15 },
			{ x: 218, y: 10, radius: 15 },
			{ x: 220, y: 10, radius: 15 },
			{ x: 222, y: 10, radius: 15 },
			{ x: 224, y: 10, radius: 15 },
			{ x: 226, y: 10, radius: 15 },
			{ x: 228, y: 10, radius: 15 },
			{ x: 230, y: 10, radius: 15 },
			{ x: 232, y: 10, radius: 15 },
			{ x: 234, y: 10, radius: 15 },
			{ x: 236, y: 10, radius: 15 },
			{ x: 238, y: 10, radius: 15 },
			{ x: 240, y: 10, radius: 15 },
			{ x: 242, y: 10, radius: 15 },
			{ x: 244, y: 10, radius: 15 },
			{ x: 246, y: 10, radius: 15 },
			{ x: 248, y: 10, radius: 15 },
			{ x: 250, y: 10, radius: 15 },
			{ x: 252, y: 10, radius: 15 },
			{ x: 254, y: 10, radius: 15 },
			{ x: 256, y: 10, radius: 15 },
			{ x: 258, y: 10, radius: 15 },
			{ x: 260, y: 10, radius: 15 },
			{ x: 262, y: 10, radius: 15 },
			{ x: 264, y: 10, radius: 15 },
			{ x: 266, y: 10, radius: 15 },
			{ x: 268, y: 10, radius: 15 },
			{ x: 270, y: 10, radius: 15 },
			{ x: 272, y: 10, radius: 15 },
			{ x: 274, y: 10, radius: 15 },
			{ x: 276, y: 10, radius: 15 },
			{ x: 278, y: 10, radius: 15 },
			{ x: 280, y: 10, radius: 15 },
			{ x: 282, y: 10, radius: 15 },
			{ x: 284, y: 10, radius: 15 },
			{ x: 286, y: 10, radius: 15 },
			{ x: 288, y: 10, radius: 15 },
			{ x: 290, y: 10, radius: 15 },
			{ x: 292, y: 10, radius: 15 },
			{ x: 294, y: 10, radius: 15 },
			{ x: 296, y: 10, radius: 15 },
			{ x: 298, y: 10, radius: 15 },
			{ x: 300, y: 10, radius: 15 },
			//
			{ x: 270, y: 10, radius: 15 },
			{ x: 270, y: 12, radius: 15 },
			{ x: 270, y: 14, radius: 15 },
			{ x: 270, y: 16, radius: 15 },
			{ x: 270, y: 18, radius: 15 },
			{ x: 270, y: 20, radius: 15 },
			{ x: 270, y: 22, radius: 15 },
			{ x: 270, y: 24, radius: 15 },
			{ x: 270, y: 26, radius: 15 },
			{ x: 270, y: 28, radius: 15 },
			{ x: 270, y: 30, radius: 15 },
			{ x: 270, y: 32, radius: 15 },
			{ x: 270, y: 34, radius: 15 },
			{ x: 270, y: 36, radius: 15 },
			{ x: 270, y: 38, radius: 15 },
			{ x: 270, y: 40, radius: 15 },
			{ x: 270, y: 42, radius: 15 },
			{ x: 270, y: 44, radius: 15 },
			{ x: 270, y: 46, radius: 15 },
			{ x: 270, y: 48, radius: 15 },
			{ x: 270, y: 50, radius: 15 },
			{ x: 270, y: 52, radius: 15 },
			{ x: 270, y: 54, radius: 15 },
			{ x: 270, y: 56, radius: 15 },
			{ x: 270, y: 58, radius: 15 },
			{ x: 270, y: 60, radius: 15 },
			{ x: 270, y: 62, radius: 15 },
			{ x: 270, y: 64, radius: 15 },
			{ x: 270, y: 66, radius: 15 },
			{ x: 270, y: 68, radius: 15 },
			{ x: 270, y: 70, radius: 15 },
			{ x: 270, y: 72, radius: 15 },
			{ x: 270, y: 74, radius: 15 },
			{ x: 270, y: 76, radius: 15 },
			{ x: 270, y: 78, radius: 15 },
			{ x: 270, y: 80, radius: 15 },
			{ x: 270, y: 82, radius: 15 },
			{ x: 270, y: 84, radius: 15 },
			{ x: 270, y: 86, radius: 15 },
			{ x: 270, y: 88, radius: 15 },
			{ x: 270, y: 90, radius: 15 },
			{ x: 270, y: 92, radius: 15 },
			{ x: 270, y: 94, radius: 15 },
			{ x: 270, y: 96, radius: 15 },
			{ x: 270, y: 98, radius: 15 },
			{ x: 270, y: 100, radius: 15 },
			{ x: 285, y: 12, radius: 15 },
			{ x: 285, y: 14, radius: 15 },
			{ x: 285, y: 16, radius: 15 },
			{ x: 285, y: 18, radius: 15 },
			{ x: 285, y: 20, radius: 15 },
			{ x: 285, y: 22, radius: 15 },
			{ x: 285, y: 24, radius: 15 },
			{ x: 285, y: 26, radius: 15 },
			{ x: 285, y: 28, radius: 15 },
			{ x: 285, y: 30, radius: 15 },
			{ x: 285, y: 32, radius: 15 },
			{ x: 285, y: 34, radius: 15 },
			{ x: 285, y: 36, radius: 15 },
			{ x: 285, y: 38, radius: 15 },
			{ x: 285, y: 40, radius: 15 },
			{ x: 285, y: 42, radius: 15 },
			{ x: 285, y: 44, radius: 15 },
			{ x: 285, y: 46, radius: 15 },
			{ x: 285, y: 48, radius: 15 },
			{ x: 285, y: 50, radius: 15 },
			{ x: 285, y: 52, radius: 15 },
			{ x: 285, y: 54, radius: 15 },
			{ x: 285, y: 56, radius: 15 },
			{ x: 285, y: 58, radius: 15 },
			{ x: 285, y: 60, radius: 15 },
			{ x: 285, y: 62, radius: 15 },
			{ x: 285, y: 64, radius: 15 },
			{ x: 285, y: 66, radius: 15 },
			{ x: 285, y: 68, radius: 15 },
			{ x: 285, y: 70, radius: 15 },
			{ x: 285, y: 72, radius: 15 },
			{ x: 285, y: 74, radius: 15 },
			{ x: 285, y: 76, radius: 15 },
			{ x: 285, y: 78, radius: 15 },
			{ x: 285, y: 80, radius: 15 },
			{ x: 285, y: 82, radius: 15 },
			{ x: 285, y: 84, radius: 15 },
			{ x: 285, y: 86, radius: 15 },
			{ x: 285, y: 88, radius: 15 },
			{ x: 285, y: 90, radius: 15 },
			{ x: 285, y: 92, radius: 15 },
			{ x: 285, y: 94, radius: 15 },
			{ x: 285, y: 96, radius: 15 },
			{ x: 285, y: 98, radius: 15 },
			{ x: 285, y: 100, radius: 15 },
		],
		// SUPER HACK - for level 2, change timer so it's impossible to beat if you go BACKWARDS.
		// countdown: 200
		countdown: 200
	},
	{
		canvas:document.getElementById("canvas_5"),
		player:{ x:150, y:170 },
		door:{ x:150, y:60 },
		key:{ x:150, y:275 },
		circles: [
			{x:0,y:150,radius:100},
			{x:300,y:150,radius:100}
		],
		countdown: 100
	},


	

	//last one
	// {
	// 	canvas: document.getElementById("canvas_4"),
	// 	player: { x: 150, y: 235 },
	// 	door: { x: 150, y: 249 },
	// 	key: { x: 150, y: 235 },
	// 	circles: [
	// 		{ x: 100, y: 100, radius: 50 },
	// 		{ x: 200, y: 100, radius: 50 },
	// 		{ x: 150, y: 100, radius: 10, invisible: true },
	// 		{ x: 0, y: 300, radius: 145 },
	// 		{ x: 300, y: 300, radius: 145 }
	// 	],
	// 	// SUPER HACK - for level 2, change timer so it's impossible to beat if you go BACKWARDS.
	// 	// countdown: 200
	// 	countdown: Infinity
	// }

];



// Animation Timeline

const animationTimeline = () => {
	// Spit chars that needs to be animated individually
	const textBoxChars = document.getElementsByClassName("hbd-chatbox")[0];
	const hbd = document.getElementsByClassName("wish-hbd")[0];
  
	textBoxChars.innerHTML = `<span>${textBoxChars.innerHTML
	  .split("")
	  .join("</span><span>")}</span`;
  
	hbd.innerHTML = `<span>${hbd.innerHTML
	  .split("")
	  .join("</span><span>")}</span`;
  
	const ideaTextTrans = {
	  opacity: 0,
	  y: -20,
	  rotationX: 5,
	  skewX: "15deg",
	};
  
	const ideaTextTransLeave = {
	  opacity: 0,
	  y: 20,
	  rotationY: 5,
	  skewX: "-15deg",
	};
	console.log(STAGE)

		const tl = new TimelineMax({ delay: 10.5 });

		tl.to(".container", 0.1, {
			visibility: "visible",
		})
			.from(".one", 1.5, {
				opacity: 0,
				y: 10,
			})
			.from(".two", 0.4, {
				opacity: 0,
				y: 10,
			})
			.to(
				".one",
				1.5,
				{
					opacity: 0,
					y: 10,
				},
				"+=2.5"
			)
			.to(
				".two",
				0.7,
				{
					opacity: 0,
					y: 10,
				},
				"-=1"
			)
			.from(".three", 0.7, {
				opacity: 0,
				y: 10,
				// scale: 0.7
			})
			.to(
				".three",
				0.7,
				{
					opacity: 0,
					y: 10,
				},
				"+=2"
			)
			.from(".four", 0.7, {
				scale: 0.2,
				opacity: 0,
			})
			.from(".fake-btn", 0.3, {
				scale: 0.2,
				opacity: 0,
			})
			.staggerTo(
				".hbd-chatbox span",
				0.5,
				{
					visibility: "visible",
				},
				0.05
			)
			.to(".fake-btn", 0.1, {
				backgroundColor: "rgb(127, 206, 248)",
			})
			.to(
				".four",
				0.5,
				{
					scale: 0.2,
					opacity: 0,
					y: -150,
				},
				"+=0.7"
			)
			.from(".idea-1", 0.7, ideaTextTrans)
			.to(".idea-1", 0.7, ideaTextTransLeave, "+=1.5")
			.from(".idea-2", 0.7, ideaTextTrans)
			.to(".idea-2", 0.7, ideaTextTransLeave, "+=1.5")
			.from(".idea-3", 0.7, ideaTextTrans)
			.to(".idea-3 strong", 0.5, {
				scale: 1.2,
				x: 10,
				backgroundColor: "rgb(21, 161, 237)",
				color: "#fff",
			})
			.to(".idea-3", 0.7, ideaTextTransLeave, "+=1.5")
			.from(".idea-4", 0.7, ideaTextTrans)
			.to(".idea-4", 0.7, ideaTextTransLeave, "+=1.5")
			.from(
				".idea-5",
				0.7,
				{
					rotationX: 15,
					rotationZ: -10,
					skewY: "-5deg",
					y: 50,
					z: 10,
					opacity: 0,
				},
				"+=0.5"
			)
			.to(
				".idea-5 span",
				0.7,
				{
					rotation: 90,
					x: 8,
				},
				"+=0.4"
			)
			.to(
				".idea-5",
				0.7,
				{
					scale: 0.2,
					opacity: 0,
				},
				"+=2"
			)
			.staggerFrom(
				".idea-6 span",
				0.8,
				{
					scale: 3,
					opacity: 0,
					rotation: 15,
					ease: Expo.easeOut,
				},
				0.2
			)
			.staggerTo(
				".idea-6 span",
				0.8,
				{
					scale: 3,
					opacity: 0,
					rotation: -15,
					ease: Expo.easeOut,
				},
				0.2,
				"+=1"
			)
			.staggerFromTo(
				".baloons img",
				2.5,
				{
					opacity: 0.9,
					y: 1400,
				},
				{
					opacity: 1,
					y: -1000,
				},
				0.2
			)
			.from(
				".girl-dp",
				0.5,
				{
					scale: 3.5,
					opacity: 0,
					x: 25,
					y: -25,
					rotationZ: -45,
				},
				"-=2"
			)
			.from(".hat", 0.5, {
				x: -100,
				y: 350,
				rotation: -180,
				opacity: 0,
			})
			.staggerFrom(
				".wish-hbd span",
				0.7,
				{
					opacity: 0,
					y: -50,
					// scale: 0.3,
					rotation: 150,
					skewX: "30deg",
					ease: Elastic.easeOut.config(1, 0.5),
				},
				0.1
			)
			.staggerFromTo(
				".wish-hbd span",
				0.7,
				{
					scale: 1.4,
					rotationY: 150,
				},
				{
					scale: 1,
					rotationY: 0,
					color: "#ff69b4",
					ease: Expo.easeOut,
				},
				0.1,
				"party"
			)
			.from(
				".wish h5",
				0.5,
				{
					opacity: 0,
					y: 10,
					skewX: "-15deg",
				},
				"party"
			)
			.staggerTo(
				".eight svg",
				1.5,
				{
					visibility: "visible",
					opacity: 0,
					scale: 80,
					repeat: 3,
					repeatDelay: 1.4,
				},
				0.3
			)
			.to(".six", 0.5, {
				opacity: 0,
				y: 30,
				zIndex: "-1",
			})
			.staggerFrom(".nine p", 1, ideaTextTrans, 1.2)
			.to(
				".last-smile",
				0.5,
				{
					rotation: 90,
				},
				"+=1"
			);
  
	// tl.seek("currentStep");
	// tl.timeScale(2);
  
	// Restart Animation on click
	const replyBtn = document.getElementById("replay");
	replyBtn.addEventListener("click", () => {
	  tl.restart();
	});
  };
  
  // Import the data to customize and insert them into page
  const fetchData = () => {
	fetch("customize.json")
	  .then((data) => data.json())
	  .then((data) => {
		Object.keys(data).map((customData) => {
		  if (data[customData] !== "") {
			if (customData === "imagePath") {
			  document
				.getElementById(customData)
				.setAttribute("src", data[customData]);
			} else {
			  document.getElementById(customData).innerText = data[customData];
			}
		  }
		});
	  });
  };
  
  // Run fetch and animation in sequence
  const resolveFetch = () => {
	return new Promise((resolve, reject) => {
	  fetchData();
	  resolve("Fetch done!");
	});
  };
  
  const waitForStageToBeThree = () => {
	const interval = setInterval(() => {
		// Check if STAGE is 3
		if (STAGE === 4) {
			clearInterval(interval); // Stop checking once we get the desired stage
			animationTimeline(); // Run the animation
		}
	}, 100); // Check every 100ms
};

// Run fetch first, then wait for STAGE to be 3
resolveFetch().then(() => {
	waitForStageToBeThree();
});
  

