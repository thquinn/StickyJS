// TODO: More fun score effects.
// TODO: Better sparkles.
// TODO: Store highscore: http://html5doctor.com/storing-data-the-simple-html5-way-and-a-few-tricks-you-might-not-have-known/
// TODO: Sound?
// TODO: If you destroy a piece that is a superset of the shape, you get partial credit?
// TODO: Come up with a name.
// TODO: Some kind of reward, visual or score-wise, for exploding large shapes.
// TODO: Look into a difficulty falloff: i.e. sublinear spawn rate increases.
// TODO: Cram util.js up here, load the font here, and wait until it's loaded to show anything.

// MECHANIC: Upgrades? Diagonal connections, longer paths, occasional piece removal, occasional polyomino removal, paths through long pieces, free pathing through empty space?
// MECHANIC: Wildcards? Rocks?

var StateEnum = {
	TITLE: -2,
	SETUP: -1,
	RUNNING: 0,
	GAME_OVER: 1,
};
var KeyBindings = {
	INCREASE_LEVEL: 32,
};	

// Board appearance constants.
var COLORS = ['#FF7979', '#90D4FF', '#FFEA5E', '#6CFF77', '#BC9BFF'];
var STROKE_COLORS = ['#FF0000', '#20B0FF', '#F0D000', '#00D010', '#8040FF'];
var BASE_COLOR = '#707090';
var BOARD_WIDTH = 15;
var BOARD_HEIGHT = 12;
var PIECE_SIZE = 60;
var STROKE_WIDTH = 10;
var BOARD_PADDING = PIECE_SIZE;
var CONNECTION_APPEARANCE_RATE = .2;
var SETUP_SPAWN_RATE = 1; // frames per piece
var POST_SETUP_PAUSE = 45;
var SELECTION_OPACITY = .4;
var SELECTION_END_RADIUS = PIECE_SIZE / 6;
var SELECTION_INVALID_COLOR = '#FFC0C0';
var BOARD_GAME_OVER_DESATURATION = .925;
// UI constants.
var UI_TITLE_FADE_RATE = .025;
var UI_WIDTH = PIECE_SIZE * 8;
var UI_SCORE_DIGITS = 10;
var UI_SCORE_FONT_SIZE = UI_WIDTH / UI_SCORE_DIGITS * 1.75;
var UI_LEVEL_CIRCLE_RADIUS = PIECE_SIZE * .66;
var UI_POLYOMINO_AREA_SIZE = PIECE_SIZE * 2.5;
var UI_POLYOMINO_BLOCK_FILL = .8;
var UI_GAME_OVER_FADE_TIME = 60;
// Text constants.
var TEXT_INSTRUCTIONS = ["There are " + COLORS.length + " colors of blocks. CLICK and DRAG to select them.", "Drag a length-" + COLORS.length + " line through one block of each color.", "Release the mouse button and they will VANISH.", "If it's too easy, press SPACE to go faster and get a multiplier boost.", "", "Click to begin."];
// Background constants.
var BACKGROUND_TILT = Math.PI * .05;
var BACKGROUND_SQUIGGLE_COLOR = "rgba(0, 0, 255, .0125)";
var BACKGROUND_SQUIGGLE_SIZE = PIECE_SIZE * 5;
// Effects appearance.
var EFFECTS_VANISH_INIT_VELOCITY = PIECE_SIZE / 1000;
var EFFECTS_VANISH_INIT_VELOCITY_VARIANCE = EFFECTS_VANISH_INIT_VELOCITY / 5;
var EFFECTS_VANISH_HORIZONTAL_VELOCITY_RANGE = PIECE_SIZE / 1500;
var EFFECTS_VANISH_ROTATIONAL_VELOCITY_RANGE = Math.PI * .000015;
var EFFECTS_VANISH_FADE_SPEED = .02;
var EFFECTS_SPARKLE_COUNT = 4;
var EFFECTS_SPARKLE_RADIUS = PIECE_SIZE / 16;
var EFFECTS_SPARKLE_INIT_VELOCITY = PIECE_SIZE / 60;
var EFFECTS_SPARKLE_INIT_VELOCITY_VARIANCE = PIECE_SIZE / 60;
var EFFECTS_SPARKLE_LIFT = PIECE_SIZE / 800;
var EFFECTS_SPARKLE_HORIZONTAL_VELOCITY_RANGE = PIECE_SIZE / 35;
var EFFECTS_SPARKLE_HORIZONTAL_DRAG = .99;
var EFFECTS_SPARKLE_FADE_SPEED = .01;
// Gameplay constants.
var SETUP_ROWS = 6;
var COLUMN_SELECTION_WEIGHT_EXPONENT = 5;
var COLOR_SELECTION_WEIGHT_MIN = 10;
var COLOR_SELECTION_WEIGHT_EXPONENT = 2;
var INITIAL_FALL_VELOCITY = .1;
var GRAVITY = .005;
var LEVEL_RATE = 40 * 60; // 40 seconds
var SPAWN_RATE_INITIAL = .75; // pieces spawned per second
var SPAWN_RATE_INCREMENT = .1;
var MULTIPLIER_INCREMENT = .05;
var MULTIPLIER_FORCE_INCREMENT = .1;
var LEVEL_UP_FORCE_COOLDOWN = 1.5 * 60; // 1.5 seconds
var CONNECTION_RATE = .01;

var canvas = document.getElementById('canvas');
canvas.width = BOARD_WIDTH * PIECE_SIZE + 2 * BOARD_PADDING + UI_WIDTH;
canvas.height = BOARD_HEIGHT * PIECE_SIZE + 2 * BOARD_PADDING;
var ctx = canvas.getContext('2d');
ctx.lineWidth = STROKE_WIDTH;
ctx.lineCap = "square";

var clock, state, titleFade, board, keysPressed, keysDown, levelTimer, levelUpForceCooldown, spawnTimer, selected, level, score, multiplier, spawnBlocked, gameOverClock, moused, mouseDown, polyomino, polyominoBounty, polyominosScored, showPolyominoTooltip;
function start() {
	clock = 0;
	state = StateEnum.TITLE;
	titleFade = 1.0;
	board = new Array(BOARD_WIDTH);
	for (var i = 0; i < BOARD_WIDTH; i++) {
		board[i] = new Array(BOARD_HEIGHT);
	}
	keysPressed = new Set();
	keysDown = new Set();
	levelTimer = LEVEL_RATE;
	levelUpForceCooldown = 0;
	spawnTimer = 0;
	selected = [];
	level = 1;
	score = 0;
	multiplier = 1;
	spawnBlocked = false;
	gameOverClock = 0;
	moused = [];
	mouseDown = false;
	polyomino = null;
	nextPolyomino();
	showPolyominoTooltip = false;
}

class Piece {
	constructor(col) {
		if (spawnBlocked) {
			return;
		}
		// Select column.
		if (col == null) {
			var xWeights = new Array(BOARD_WIDTH).fill(0);
			for (var x = 0; x < BOARD_WIDTH; x++) {
				for (; xWeights[x] < BOARD_HEIGHT; xWeights[x]++) {
					if (board[x][xWeights[x]] != null) {
						break;
					}
				}
				xWeights[x] = Math.pow(xWeights[x], COLUMN_SELECTION_WEIGHT_EXPONENT);
			}
			this.x = Math.pickFromWeightArray(xWeights);
		} else {
			this.x = col;
		}
		this.y = 0;
		while (this.y < BOARD_HEIGHT - 1 && board[this.x][this.y + 1] == null) {
			this.y++;
		}
		// Select color.
		var colorWeights = new Array(COLORS.length).fill(COLOR_SELECTION_WEIGHT_MIN);
		for (var x = 0; x < BOARD_WIDTH; x++) {
			for (var y = 0; y < BOARD_WIDTH; y++) {
				if (board[x][y] != null) {
					colorWeights[board[x][y].color]++;
				}
			}
		}
		for (var i = 0; i < colorWeights.length; i++) {
			colorWeights[i] = 1 / Math.pow(colorWeights[i], COLOR_SELECTION_WEIGHT_EXPONENT);
		}
		this.color = Math.pickFromWeightArray(colorWeights);
		// Initialize.
		board[this.x][this.y] = this;
		this.dy = INITIAL_FALL_VELOCITY;
		this.fallDistance = this.y + 1 + BOARD_PADDING / PIECE_SIZE;
		this.connection = [0, 0, 0, 0];
		this.connectionAppearance = [0, 0, 0, 0];
		this.root = this;
		this.children = new Set([this]);
	}

	update(setup) {
		if (this.fallDistance > 0) {
			this.dy += GRAVITY;
			var distanceToLowerNeighbor = Number.MAX_SAFE_INTEGER;
			if (this.y < BOARD_HEIGHT - 1 && board[this.x][this.y + 1] != null && board[this.x][this.y + 1].fallDistance > 0) {
				var neighborTop = (board[this.x][this.y + 1].y - board[this.x][this.y + 1].fallDistance);
				distanceToLowerNeighbor = neighborTop - (this.y - this.fallDistance + 1);
			}
			var fall = Math.min(this.dy, this.fallDistance, distanceToLowerNeighbor);
			if (fall == 0) {
				this.dy = 0;
			}
			this.fallDistance -= fall;
		} else {
			this.dy = 0;
		}
		if (setup) {
			return;
		}

		// Update connections and connection appearances.
		for (var i = 0; i < this.connection.length; i++) {
			if (this.connection[i] < 1) {
				var nx = this.x + NEIGHBORS[i][0];
				var ny = this.y + NEIGHBORS[i][1];
				if (nx < 0 || nx >= BOARD_WIDTH || ny < 0 || ny >= BOARD_HEIGHT || board[nx][ny] == null || board[nx][ny].color != this.color) {
					this.connection[i] = 0;
				} else if (this.fallDistance > 0 || board[nx][ny].fallDistance > 0) {
					// TODO: Fix connections still breaking while falling in parallel.
					var iReverse = (i / 2) * 2 + ((i + 1) % 2);
					this.connection[i] = Math.min(this.connection[i], board[nx][ny].connection[iReverse]);
				} else {
					this.connection[i] = Math.min(this.connection[i] + CONNECTION_RATE, 1);
					if (this.connection[i] == 1) {
						// Connect!
						var neighbor = board[nx][ny];
						if (!neighbor.root.children.has(this)) {
							for (let child of neighbor.root.children) {
								this.root.children.add(child);
							}
							for (let child of this.root.children) {
								child.root = this.root;
							}
						}
					}
				}
			}
			if (this.connection[i] == 1 || Math.abs(this.connection[i] - this.connectionAppearance[i]) < .001) {
				this.connectionAppearance[i] = this.connection[i];
			} else {
				this.connectionAppearance[i] = this.connectionAppearance[i] * (1 - CONNECTION_APPEARANCE_RATE) + this.connection[i] * CONNECTION_APPEARANCE_RATE;
			}
		}
	}
	draw() {
		var trueY = this.y - this.fallDistance;
		// Stroke.
		ctx.fillStyle = STROKE_COLORS[this.color];
		ctx.fillRect(BOARD_PADDING + this.x * PIECE_SIZE, trueY * PIECE_SIZE, PIECE_SIZE, PIECE_SIZE);
		// Horizontal fill.
		ctx.fillStyle = COLORS[this.color];
		ctx.fillRect(BOARD_PADDING + this.x * PIECE_SIZE + STROKE_WIDTH * (1 - this.connectionAppearance[0]), trueY * PIECE_SIZE + STROKE_WIDTH, PIECE_SIZE - (2 - this.connectionAppearance[0] - this.connectionAppearance[1]) * STROKE_WIDTH, PIECE_SIZE - 2 * STROKE_WIDTH);
		// Vertical fill.
		ctx.fillStyle = COLORS[this.color];
		ctx.fillRect(BOARD_PADDING + this.x * PIECE_SIZE + STROKE_WIDTH, trueY * PIECE_SIZE + STROKE_WIDTH * (1 - this.connectionAppearance[2]), PIECE_SIZE - 2 * STROKE_WIDTH, PIECE_SIZE - (2 - this.connectionAppearance[2] - this.connectionAppearance[3])  * STROKE_WIDTH);
		// Selection overlay.
		for (let s of selected) {
			if (board[s[0]][s[1]].root == this.root) {
				ctx.fillStyle = "rgba(255, 255, 255, " + SELECTION_OPACITY + ")";
				ctx.fillRect(BOARD_PADDING + this.x * PIECE_SIZE, (this.y - this.fallDistance) * PIECE_SIZE, PIECE_SIZE, PIECE_SIZE);
				break;
			}
		}
	}
	destroy() {
		score = Math.round(score + this.root.children.size * 100 * multiplier);
		if (polyomino.isThis(this.root)) {
			nextPolyomino();
		}
		for (let child of this.root.children) {
			board[child.x][child.y] = null;
			effects.vanish(child.x, child.y);
		}
	}
}

class Background {
	constructor() {
		this.squiggles = [];
		for (var i = 0; i < 15; i++) {
			this.squiggles.push(new Squiggle());
		}
	}
	update() {
		for (let squiggle of this.squiggles) {
			squiggle.update();
		}
	}
	draw() {
		ctx.fillStyle = "#D0E8FF";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate(BACKGROUND_TILT);
		ctx.translate(-canvas.width / 2, -canvas.height / 2);
		ctx.fillStyle = BACKGROUND_SQUIGGLE_COLOR;
		for (let squiggle of this.squiggles) {
			squiggle.draw();
		}
		ctx.restore();
	}
}
class Squiggle {
	constructor() {
		this.coor = [Math.random() * canvas.width, Math.random() * canvas.height];
		this.horiz = Math.random() < .5;
		this.newTarget();
		this.frames = 0;
	}
	newTarget() {
		this.target = this.coor.slice();
		var delta;
		if (this.horiz) {
			this.target[0] = canvas.width * -.5 + 1.5 * Math.random() * canvas.width;
			delta = this.target[0] - this.coor[0];
		} else {
			this.target[1] = canvas.height * -.5 + 1.5 * Math.random() * canvas.height;
			delta = this.target[1] - this.coor[1];
		}
		this.waitFrames = Math.randInt(10, 25);
		this.moveFrames = Math.round(Math.randFloat(.33, .5) * Math.abs(delta));
	}
	update() {
		this.frames++;
		if (this.frames == this.waitFrames + this.moveFrames) {
			this.coor = this.target;
			this.horiz = !this.horiz;
			this.newTarget();
			this.frames = 0;
		}
	}
	draw() {
		var interpVal = this.frames < this.waitFrames ? 0 : (this.frames - this.waitFrames) / (this.moveFrames);
		var leftRight, topBottom;
		if (this.coor[0] != this.target[0]) {
			leftRight = this.getDrawCoors(this.coor[0], this.target[0], interpVal);
			topBottom = [this.coor[1], this.coor[1] + BACKGROUND_SQUIGGLE_SIZE];
		} else {
			leftRight = [this.coor[0], this.coor[0] + BACKGROUND_SQUIGGLE_SIZE];
			topBottom = this.getDrawCoors(this.coor[1], this.target[1], interpVal);
		}
		ctx.fillRect(leftRight[0], topBottom[0], leftRight[1] - leftRight[0], topBottom[1] - topBottom[0]);
	}
	getDrawCoors(val, target, interpVal) {
		var coors = [interpVal <= .5 ? val : Math.easeInOutQuad(interpVal - .5, val, (target - val), .5),
					 interpVal <= .5 ? Math.easeInOutQuad(interpVal, val, (target - val), .5) : target];
		coors.sort(function(a, b){return a - b});
		coors[1] += BACKGROUND_SQUIGGLE_SIZE;
		return coors;
	}
}
var background = new Background();

class Effects {
	constructor() {
		this.vanishes = [];
		this.sparkles = [];
	}
	vanish(x, y) {
		this.vanishes.push(new Vanish(x, y));
		for (var i = 0; i < EFFECTS_SPARKLE_COUNT; i++) {
			var sx = BOARD_PADDING + x * PIECE_SIZE + Math.random() * PIECE_SIZE;
			var sy = y * PIECE_SIZE + Math.random() * PIECE_SIZE;
			this.sparkles.push(new Sparkle(sx, sy));
		}
	}
	update() {
		for (var i = this.vanishes.length - 1; i >= 0; i--) {
			this.vanishes[i].update();
			if (this.vanishes[i].alpha == 0) {
				this.vanishes.splice(i, 1);
			}
		}
		for (var i = this.sparkles.length - 1; i >= 0; i--) {
			this.sparkles[i].update();
			if (this.sparkles[i].alpha == 0) {
				this.sparkles.splice(i, 1);
			}
		}
	}
	draw() {
		for (let vanish of this.vanishes) {
			vanish.draw();
		}
		for (let sparkle of this.sparkles) {
			sparkle.draw();
		}
	}
}
class Vanish {
	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.dx = Math.randFloat(-EFFECTS_VANISH_HORIZONTAL_VELOCITY_RANGE, EFFECTS_VANISH_HORIZONTAL_VELOCITY_RANGE);
		this.dy = -EFFECTS_VANISH_INIT_VELOCITY + Math.randFloat(-EFFECTS_VANISH_INIT_VELOCITY_VARIANCE, EFFECTS_VANISH_INIT_VELOCITY_VARIANCE);
		this.theta = 0;
		this.dTheta = Math.randFloat(-EFFECTS_VANISH_ROTATIONAL_VELOCITY_RANGE, EFFECTS_VANISH_ROTATIONAL_VELOCITY_RANGE);
		this.alpha = 1 + EFFECTS_VANISH_FADE_SPEED;
	}
	update() {
		this.dy += GRAVITY * PIECE_SIZE / 50;
		this.x += this.dx;
		this.y += this.dy;
		this.theta += this.dTheta;
		this.alpha = Math.max(0, this.alpha - EFFECTS_VANISH_FADE_SPEED);
	}
	draw() {
		var px = BOARD_PADDING + this.x * PIECE_SIZE;
		var py = this.y * PIECE_SIZE;
		ctx.save();
		ctx.translate(px + PIECE_SIZE / 2, py + PIECE_SIZE / 2);
		ctx.rotate(this.theta * 1000);
		ctx.translate(-px - PIECE_SIZE / 2, -py - PIECE_SIZE / 2);
		ctx.fillStyle = "rgba(255, 255, 255, " + this.alpha + ")";
		ctx.fillRect(px, py, PIECE_SIZE, PIECE_SIZE);
		ctx.restore();
	}
}
class Sparkle {
	constructor(x, y) {
		this.x = x;
		this.y = y;
		this.dx = Math.randFloat(-EFFECTS_SPARKLE_HORIZONTAL_VELOCITY_RANGE, EFFECTS_SPARKLE_HORIZONTAL_VELOCITY_RANGE);
		this.dy = -EFFECTS_SPARKLE_INIT_VELOCITY;
		this.dy += Math.randFloat(-EFFECTS_SPARKLE_INIT_VELOCITY_VARIANCE, EFFECTS_SPARKLE_INIT_VELOCITY_VARIANCE)
		this.alpha = 1 + EFFECTS_SPARKLE_FADE_SPEED;
	}
	update() {
		this.dx *= EFFECTS_SPARKLE_HORIZONTAL_DRAG;
		this.dy -= EFFECTS_SPARKLE_LIFT;
		this.x += this.dx;
		this.y += this.dy;
		this.alpha = Math.max(0, this.alpha - EFFECTS_SPARKLE_FADE_SPEED);
	}
	draw() {
		ctx.beginPath();
		ctx.arc(this.x, this.y, EFFECTS_SPARKLE_RADIUS, 0, 2 * Math.PI, false);
		ctx.fillStyle = "rgba(255, 255, 255, " + this.alpha + ")";
		ctx.fill();
	}
}
var effects = new Effects();

function loop() {
	window.requestAnimationFrame(loop);
	background.update();
	background.draw();

	// Setup.
	if (state == StateEnum.SETUP) {
		if (clock % SETUP_SPAWN_RATE == 0) {
			var pieceNum = clock / SETUP_SPAWN_RATE;
			if (pieceNum < SETUP_ROWS * BOARD_WIDTH) {
				var x = pieceNum % BOARD_WIDTH;
				new Piece(x);
			}
		}
		if (clock == SETUP_ROWS * BOARD_WIDTH * SETUP_SPAWN_RATE + POST_SETUP_PAUSE) {
			state = StateEnum.RUNNING;
		}
	}

	// Game over check.
	if (state == StateEnum.RUNNING) {
		spawnBlocked = true;
		var gameOver = true;
		for (var x = 0; x < BOARD_WIDTH; x++) {
			if (board[x][0] == null) {
				spawnBlocked = false;
			}
			if (board[x][0] == null || board[x][0].fallDistance > 0) {
				gameOver = false;
			}
		}
		if (gameOver) {
			selected = [];
			state = StateEnum.GAME_OVER;
		}
	}

	// Update pieces.	
	if (state == StateEnum.SETUP || state == StateEnum.RUNNING) {
		for (var x = 0; x < BOARD_WIDTH; x++) {
			for (var y = BOARD_HEIGHT - 1; y >= 0; y--) {
				if (board[x][y] == null) {
					continue;
				}
				board[x][y].update(state == StateEnum.SETUP);
			}
		}
	}
	// Update everything else.
	if (state == StateEnum.RUNNING) {
		// Level up.
		if (levelUpForceCooldown > 0) {
			levelUpForceCooldown--;
		}
		levelTimer--;
		if (levelTimer == 0) {
			level++;
			multiplier += MULTIPLIER_INCREMENT;
			levelTimer = LEVEL_RATE;
		} else if (keysPressed.has(KeyBindings.INCREASE_LEVEL) && levelUpForceCooldown == 0) {
			level++;
			var add = Math.precisionRound(Math.lerp(MULTIPLIER_INCREMENT, MULTIPLIER_FORCE_INCREMENT, levelTimer / LEVEL_RATE), 2);
			multiplier = Math.precisionRound(multiplier + add, 2);
			levelUpForceCooldown = LEVEL_UP_FORCE_COOLDOWN;
			levelTimer = LEVEL_RATE;
		}
		// Spawn pieces.
		if (spawnTimer <= 0) {
			if (!spawnBlocked) {
				new Piece();
				var rate = SPAWN_RATE_INITIAL + (level - 1) * SPAWN_RATE_INCREMENT;
				spawnTimer += 60 / rate;
			}
		} else {
			spawnTimer--;
		}
	}
	
	// Draw pieces.
	for (var x = 0; x < BOARD_WIDTH; x++) {
		for (var y = BOARD_HEIGHT - 1; y >= 0; y--) {
			if (board[x][y] == null) {
				continue;
			}
			board[x][y].draw();
		}
	}
	// Draw desaturation overlay.
	if (state == StateEnum.GAME_OVER) {
		var alpha = Math.min(gameOverClock / UI_GAME_OVER_FADE_TIME, 1) * BOARD_GAME_OVER_DESATURATION;
		ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
		ctx.globalCompositeOperation = 'saturation';
		for (var x = 0; x < BOARD_WIDTH; x++) {
			for (var y = BOARD_HEIGHT - 1; y >= 0; y--) {
				if (board[x][y] == null) {
					continue;
				}
				ctx.fillRect(BOARD_PADDING + x * PIECE_SIZE, (y - board[x][y].fallDistance) * PIECE_SIZE, PIECE_SIZE, PIECE_SIZE);
			}
		}
		ctx.globalCompositeOperation = 'source-over';
	}
	// Draw base.
	var baseY = BOARD_HEIGHT * PIECE_SIZE;
	ctx.fillStyle = BASE_COLOR;
	ctx.fillRect(BOARD_PADDING, baseY, BOARD_WIDTH * PIECE_SIZE, canvas.height - baseY);
	// Draw effects.
	effects.update();
	effects.draw();
	// Draw selection path.
	if (selected.length > 1) {
		var pathColor = "#FFFFFF";
		var selectedColors = new Set();
		for (var i = 0; i < selected.length; i++) {
			var color = board[selected[i][0]][selected[i][1]].color;
			if (selectedColors.has(color)) {
				pathColor = SELECTION_INVALID_COLOR;
				break;
			}
			selectedColors.add(color);
		}
		ctx.strokeStyle = pathColor;
		ctx.beginPath();
		var x, y;
		for (var i = 0; i < selected.length; i++) {
			x = BOARD_PADDING + (selected[i][0] + .5) * PIECE_SIZE;
			y = (selected[i][1] + .5) * PIECE_SIZE;
			i == 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
		}
		ctx.stroke();
		if (selected.length == COLORS.length) {
			ctx.fillStyle = pathColor;
			ctx.beginPath();
			ctx.arc(x, y, SELECTION_END_RADIUS, 0, 2 * Math.PI, false);
			ctx.fill();
		}
	}
	// Draw UI.
	ctx.textAlign= 'right';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = "#FFFFFF";
	ctx.font = "bold " + UI_SCORE_FONT_SIZE + "px Source Sans Pro";
	ctx.fillText(score, canvas.width - BOARD_PADDING, canvas.height / 2);
	var leadingZeroes = Math.max(0, UI_SCORE_DIGITS - score.toString().length);
	var scoreWidth = ctx.measureText(score).width;
	ctx.font = "200 " + UI_SCORE_FONT_SIZE + "px Source Sans Pro";
	ctx.fillText('0'.repeat(leadingZeroes), canvas.width - BOARD_PADDING - scoreWidth, canvas.height / 2);
	ctx.fillStyle = "#9090F0";
	ctx.font = "bold " + (UI_SCORE_FONT_SIZE / 3) + "px Source Sans Pro";
	ctx.fillText('Multiplier: ' + Math.round(multiplier * 100) + '%', canvas.width - BOARD_PADDING, canvas.height * .5625);
	var levelPercent = levelTimer / LEVEL_RATE;
	var levelX = canvas.width - BOARD_PADDING - UI_LEVEL_CIRCLE_RADIUS, levelY = canvas.height * .4125;
	ctx.beginPath();
	ctx.arc(levelX, levelY, UI_LEVEL_CIRCLE_RADIUS, Math.PI * 1.5, Math.PI * (1.5 - 2 * levelPercent), true);
	ctx.lineTo(levelX, levelY);
	ctx.fillStyle = "rgba(255, 255, 255, .5)";
	ctx.fill();
	ctx.textAlign = 'center';
	ctx.fillStyle = "#9090F0";
	ctx.font = "bold " + (UI_SCORE_FONT_SIZE / 2) + "px Source Sans Pro";
	ctx.fillText(level, levelX, levelY + UI_LEVEL_CIRCLE_RADIUS * .175);
	ctx.font = "bold " + (UI_SCORE_FONT_SIZE / 5) + "px Source Sans Pro";
	ctx.fillText("Level", levelX, levelY - UI_LEVEL_CIRCLE_RADIUS * .4);
	drawPolyominoUI();
	// Draw game over?
	if (state == StateEnum.GAME_OVER) {
		ctx.textAlign= 'right';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = "rgba(192, 0, 96, " + (gameOverClock / UI_GAME_OVER_FADE_TIME) + ")";
		ctx.font = "bold " + UI_SCORE_FONT_SIZE + "px Source Sans Pro";
		ctx.fillText("GAME OVER", canvas.width - BOARD_PADDING, canvas.height - BOARD_PADDING);
		ctx.textBaseline = 'top';
		ctx.font = (UI_SCORE_FONT_SIZE / 5) + "px Source Sans Pro";
		ctx.fillText("click anywhere to restart", canvas.width - BOARD_PADDING, canvas.height - BOARD_PADDING);
	}

	// Draw title screen.
	if (titleFade > 0) {
		ctx.fillStyle = "rgba(208, 232, 255, " + titleFade + ")";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		if (state != StateEnum.TITLE) {
			titleFade = Math.max(0, titleFade - UI_TITLE_FADE_RATE);	
		}
		ctx.textAlign= 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = "rgba(144, 144, 240, " + titleFade + ")";
		ctx.font = "bold " + (UI_SCORE_FONT_SIZE * 2) + "px Source Sans Pro";
		ctx.fillText("Game", canvas.width / 2, canvas.height / 3);
		ctx.font = (UI_SCORE_FONT_SIZE / 3) + "px Source Sans Pro";
		for (var i = 0; i < TEXT_INSTRUCTIONS.length; i++) {
			ctx.fillText(TEXT_INSTRUCTIONS[i], canvas.width / 2, canvas.height / 2 + UI_SCORE_FONT_SIZE * .5 * i);
		}
	}

	if (state != StateEnum.TITLE) {
		clock++;
	}
	if (state == StateEnum.GAME_OVER) {
		gameOverClock++;
	}

	// Update key states.
	keysPressed.clear();
}

canvas.addEventListener('mousedown', function(e) {
	var pos = mousePos(canvas, e);
	mouseDownHelper(pos.x, pos.y, e.which == 3);
});
canvas.addEventListener('touchstart', function(e) {
	if (e.touches.length == 1) {
		e.preventDefault();
	}
	var pos = touchPos(canvas, e);
	mouseDownHelper(pos.x, pos.y, false);
});
function mouseDownHelper(x, y, rightClick) {
	if (state == StateEnum.TITLE) {
		state = StateEnum.SETUP;
		return;
	}
	if (state == StateEnum.GAME_OVER && gameOverClock >= UI_GAME_OVER_FADE_TIME) {
		start();
		return;
	}
	if (state != StateEnum.RUNNING) {
		return;
	}
	if (rightClick) {
		selected = [];
		return;
	}
	mouseDown = true;
	selectCheck(x, y);
}
canvas.addEventListener('mousemove', function(e) {
	var pos = mousePos(canvas, e);
	mouseMoveHelper(pos.x, pos.y);
});
canvas.addEventListener('touchmove', function(e) {
	if (e.touches.length == 1) {
		e.preventDefault();
	}
	var pos = touchPos(canvas, e);
	mouseMoveHelper(pos.x, pos.y);
});
function mouseMoveHelper(x, y) {
	showPolyominoTooltip = x > canvas.width - BOARD_PADDING - UI_POLYOMINO_AREA_SIZE && y < BOARD_PADDING + UI_POLYOMINO_AREA_SIZE;
	if (state != StateEnum.RUNNING) {
		return;
	}
	if (mouseDown) {
		selectCheck(x, y);
	}
}
window.addEventListener('mouseup', function(e) {
	mouseUpHelper();
});
window.addEventListener('touchend', function(e) {
	if (e.touches.length == 1) {
		e.preventDefault();
	}
	mouseUpHelper();
});
function mouseUpHelper() {
	if (state != StateEnum.RUNNING) {
		return;
	}
	var colorCheck = new Set(new Array(COLORS.length).keys());
	for (var i = 0; i < selected.length; i++) {
		colorCheck.delete(board[selected[i][0]][selected[i][1]].color)
	}
	if (colorCheck.size == 0) {
		var toDestroy = new Set();
		for (var i = 0; i < selected.length; i++) {
			toDestroy.add(board[selected[i][0]][selected[i][1]].root);
		}
		for (let item of toDestroy) {
			item.destroy();
		}
		fallCheck(); // TODO: Keep this kind of thing in the main loop.
	}

	selected = [];
	mouseDown = false;
}
window.addEventListener('keydown', function(e) {
	keysPressed.add(e.keyCode);
	keysDown.add(e.keyCode);
});
window.addEventListener('keyup', function(e) {
	keysDown.delete(e.keyCode);
});
canvas.addEventListener('contextmenu', function(e) {
	e.preventDefault();
});

function selectCheck(x, y) {
	x = Math.floor((x - BOARD_PADDING) / PIECE_SIZE);
	y = Math.floor(y / PIECE_SIZE);
	if (selected.length == 0) {
		selectCheckHelper(x, y);
		return;
	}
	var coor = selected[selected.length - 1].slice();
	var dx = x - coor[0];
	while (coor[0] != x) {
		coor[0] += dx / Math.abs(dx);
		selectCheckHelper(coor[0], coor[1]);
	}
	var dy = y - coor[1];
	while (coor[1] != y) {
		coor[1] += dy / Math.abs(dy);
		selectCheckHelper(coor[0], coor[1]);
	}
}
function selectCheckHelper(x, y) {
	if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT)
		return;
	if (board[x][y] == null || board[x][y].fallDistance > 0) {
		return;
	}
	var coor = [x, y];
	if (selected.length > 1 && Array.equal(selected[selected.length - 2], coor)) {
		selected.splice(selected.length - 1, 1);
	}
	if (selected.length == COLORS.length) {
		return;
	}
	if (selected.length > 0) {
		var last = selected[selected.length - 1];
		var d = Math.abs(last[0] - x) + Math.abs(last[1] - y);
		if (d != 1) {
			return;
		}
	}
	if (Array.containsArray(selected, coor)) {
		return;
	}
	selected.push([x, y]);
}

function fallCheck() {
	// Find to-ground fall distances of shapes.
	var fallDistances = new Map();
	for (var x = 0; x < BOARD_WIDTH; x++) {
		for (var y = BOARD_HEIGHT - 1; y >= 0; y--) {
			if (board[x][y] == null) {
				continue;
			}
			var fallDistance = BOARD_HEIGHT - 1 - y;
			if (!fallDistances.has(board[x][y].root) || fallDistances.get(board[x][y].root) > fallDistance) {
				fallDistances.set(board[x][y].root, fallDistance);
			}
		}
	}
	// Update fall distances until none of them change.
	var changed = true;
	while (changed) {
		changed = false;
		for (const root of fallDistances.keys()) {
			for (const child of root.children) {
				// For each piece in this shape, look down until we hit a piece from another shape, update our fall distance if necessary.
				for (var y = child.y + 1; y < BOARD_HEIGHT; y++) {
					if (board[child.x][y] == null) {
						continue;
					}
					if (board[child.x][y].root == root) {
						break;
					}
					var newDistance = fallDistances.get(board[child.x][y].root) + Math.abs(y - child.y - 1);
					if (newDistance < fallDistances.get(root)) {
						fallDistances.set(root, newDistance);
						changed = true;
					}
					break;
				}
			}
		}
	}
	// Move pieces and add fall distances as calculated.
	for (var x = 0; x < BOARD_WIDTH; x++) {
		for (var y = BOARD_HEIGHT - 1; y >= 0; y--) {
			if (board[x][y] == null) {
				continue;
			}
			var fallDistance = fallDistances.get(board[x][y].root);
			if (fallDistance > 0) {
				board[x][y].y += fallDistance;
				board[x][y].fallDistance += fallDistance;
				board[x][y + fallDistance] = board[x][y];
				board[x][y] = null;
			}
		}
	}
}

// n-to-bounty:
//	3		4		5		6		7		8		...
//	1000	3000	6000	10000	15000	21000	...
// +1000 for each previous bounty
//
// score-to-n:
//	0		>0		>20K	>60K	>120K	>200K	...
//	3		4		5		6		7		8		...
function nextPolyomino() {
	if (polyomino == null) {
		polyomino = Polyomino.random(3);
		polyominoBounty = 1000;
		polyominosScored = 0;
		return;
	}
	score += polyominoBounty * multiplier;
	polyominosScored++;
	var n = Math.floor((Math.sqrt(score - 1 + 2500) + 350) / 100); // thanks wolfram alpha
	polyomino = Polyomino.random(n);
	polyominoBounty = 500 * (n - 2) * (n - 1) + 1000 * polyominosScored; // thanks wolfram alpha
}
function drawPolyominoUI() {
	// Draw polyomino.
	var polyPieceSize = UI_POLYOMINO_AREA_SIZE / (Math.max(polyomino.maxX, polyomino.maxY) + 1);
	var xOffset = polyomino.maxX < polyomino.maxY ? polyomino.maxY - polyomino.maxX : 0;
	ctx.fillStyle = "rgba(255, 255, 255, 1)";
	for (var i = 0; i < polyomino.coors.length; i++) {
		var coor = polyomino.coors[i];
		ctx.fillRect(canvas.width - BOARD_PADDING - UI_POLYOMINO_AREA_SIZE + (coor[0] + xOffset) * polyPieceSize + polyPieceSize * (1 - UI_POLYOMINO_BLOCK_FILL),
					 BOARD_PADDING + coor[1] * polyPieceSize,
					 polyPieceSize * UI_POLYOMINO_BLOCK_FILL,
					 polyPieceSize * UI_POLYOMINO_BLOCK_FILL);
	}
	// Draw polyomino bounty.
	ctx.fillStyle = "#9090F0";
	ctx.textAlign= 'center';
	ctx.textBaseline = 'middle';
	ctx.font = "bold " + (UI_SCORE_FONT_SIZE / 3) + "px Source Sans Pro";
	ctx.fillText('+' + polyominoBounty, canvas.width - BOARD_PADDING - (polyomino.maxX + 1) / 2 * polyPieceSize + polyPieceSize * (1 - UI_POLYOMINO_BLOCK_FILL) / 2,
										BOARD_PADDING + (polyomino.maxY + 1) / 2 * polyPieceSize - polyPieceSize * (1 - UI_POLYOMINO_BLOCK_FILL) / 2);
	// Draw polyomino tooltip.
	if (showPolyominoTooltip) {
		ctx.fillStyle = "#9090F0";
		ctx.textAlign= 'right';
		ctx.textBaseline = 'top';
		ctx.font = (UI_SCORE_FONT_SIZE / 5) + "px Source Sans Pro";
		var tooltipY = BOARD_PADDING + polyPieceSize * (polyomino.maxY + 1);
		ctx.fillText('clear a piece with this shape (can', canvas.width - BOARD_PADDING, tooltipY);
		ctx.fillText('be rotated or reflected) to gain this', canvas.width - BOARD_PADDING, tooltipY + (UI_SCORE_FONT_SIZE / 5));
		ctx.fillText('many points, times your multiplier', canvas.width - BOARD_PADDING, tooltipY + (UI_SCORE_FONT_SIZE / 5) * 2);
	}
}

start();
loop(); 