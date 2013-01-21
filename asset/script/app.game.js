// Make all prefixed requestAnimationFrame's available, and a fallback, under
// window.requestAnimFrame.
window.requestAnimFrame = ( function()
	{
		return window.requestAnimationFrame
			|| window.webkitRequestAnimationFrame
			|| window.mozRequestAnimationFrame
			|| window.oRequestAnimationFrame
			|| window.msRequestAnimationFrame
			|| function( callback )
			{
				window.setTimeout( callback, 1000 / 60 );
			};
	}
	)();

// =============================================================================
// UTIL
// =============================================================================

// Expose usefull utilities to the window
var util = window.util = {
	// Interpolation: http://en.wikipedia.org/wiki/Interpolation.
	'interpolate' : function interpolate( weight, a, b )
	{
		return a + weight * ( b - a );
	}
}

// =============================================================================
// GAME
// =============================================================================

// Main game class. This is where the magic happends. Making `game` a
// constructor allow for, although not implemented, multiple games to run
// symultaniously.
var Game = function Game( options )
{
	this.data = options;
	this.socket = new Socket( this, options.socket || {} );

	return this;
};

// Prototype for `Game`.
Game.prototype = {
	// Function that calls given strings on certain child's.
	'each' : function each( names )
	{
		// Store self.
		var _this = this;

		// `Each` takes an array. If a string was given, turn it into an array.
		if ( typeof names === 'string' )
			names = [ names ];

		// Loop over names
		names.forEach( function callback( it )
			{
				// Call `it` on the current Game's Context.
				if ( _this.context[ it ] )
					_this.context[ it ].apply( _this.context );

				// Call `it` on the current Game's player.
				if ( _this.player[ it ] )
					_this.player[ it ].apply( _this.player );
			}
		);
	}
	// __init__. Creates child instances.
	, 'init' : function init()
	{
		var options = this.data;
		this.context = new Context( this, options.context || {} );
		this.player = new Player( this, options.player || {} );

		this.splashscreen = new Drawing( this, { 'source' : this.data.splashscreen.source } );

		this.default_speed = options.speed * this.context.data.block || 256;
		this.speedx = this.default_speed;
		this.speedy = this.default_speed;
	}
	// Object that stores different time functions, constants and
	// variables.
	, 'time' : {
		  'now' : null
  		, 'start' : null
		, 'delta' : null
		, 'then' : null
		, 'seconds' : null
		// Gets called before a draw.
		, 'before' : function before()
		{
			this.now = Date.now();
			this.delta = ( this.now - ( this.then || 0 ) ) / 1000;
		}
		// Gets called after a draw.
		, 'after' : function after()
		{
			this.then = this.now;
		}
	}
	// Stores the temporary speed of the game.
	, 'temporary_speedy' : false
	// Function that calls update and draw on Player and Context, and updates 
	// the current time.
	, 'draw' : function draw()
	{
		this.time.before();

		this.each( [ 'update', 'draw' ] );

		this.time.second = Math.floor( ( this.time.now - this.time.start ) / 1000 );
		this.time.after();
	}
	// Resets Game and calls `reset` on Player and Context.
	, 'reset' : function reset()
	{
		var _this = this;

		this.each( 'reset' );

		// Load splashscreen.
		this.splashscreen.onload = function onload()
		{
			_this.context.ctx.drawImage( _this.splashscreen.node, 0, 0 );
			// Drawing.prototype.onload.call( this, arguments );
		};

		return this;
	}
	// A function that starts the Game.
	, 'start' : function start()
	{
		var _this = this;

		this.is_started = true;

		this.time.start = this.time.then = Date.now();

		this.onanimation_frame = function onanimation_frame()
		{
	        _this.draw.call( _this, requestAnimFrame( onanimation_frame ) );
		};

		this.onanimation_frame();
		
		return this;
	}
	// Draws one image on the canvas.
	, 'set_block' : function set_block( b, x, y, offsetx, offsety )
	{
		offsetx || ( offsetx = 0 );
		offsety || ( offsety = 0 );

		this.context.ctx.drawImage( b.node, x * this.data.context.block + offsetx, y * this.data.context.block + offsety );
	}
	// Draws one image multiple times on the canvas.
	, 'set_blocks' : function set_blocks( b, xmin, ymin, xmax, ymax, offsetx, offsety )
	{
		var _xmin = xmin;

		for ( ; ymin < ymax; ymin++ )
		{
			for ( ; xmin < xmax; xmin++ )
				this.set_block( b, xmin, ymin, offsetx, offsety );

			xmin = _xmin;
		}
	}
}


// =============================================================================
// SOCKET
// =============================================================================

// Connection to the socket.io socket.
var Socket = function Socket( game, options )
{
	var _this = this;

	this.game = game;
	this.data = options;

	// Get room from hash.
	this.room = window.location.hash.match( /\d+/ );
	this.room = this.room? +this.room[ 0 ] : null;

	// Connect to websocket server.
	this.connection = options.io.connect( 'ws://' + options.location + ':' + options.port );

	// Sends a knock to the socket; sends the room number.
	this.emit( 'knock', { 'room' : this.room } );

	// When the server allows the user to connect, it will return an invite.
	this.on( 'invite', function(){ _this.oninvite.apply( _this, arguments ) } );

	// When the server sends an update from the other player, call onplayerget.
	this.on( 'playerGet', function(){ _this.onplayerget.apply( _this, arguments ) } );
}

// Prototype for the socket connection.
Socket.prototype = {
	// Wrapper to call the internal socket from the Game's `Socket` instance.
	  '_call' : function call( type, args )
	{
		if ( !this.connection || !this.connection[ type ] )
			return;

		return this.connection[ type ].apply( this.connection, args );
	}
	// Wrapper to call the internal socket's `emit` function.
	, 'emit' : function emit( key, value ){ return this._call( 'emit', [ key, value ] ) }
	// Wrapper to call the internal socket's `on` function.
	, 'on' : function on( key, callback ){ return this._call( 'on', [ key, callback ] ) }
	// Event handler for the `oninvite` event.
	, 'oninvite' : function oninvite( options )
	{
		// Set the Players id to the given player number (1 or 2).
		this.game.data.player.id = options.number + 1

		// Initialize game.
		this.game.init();

		// Reset game.
		this.game.reset();
		
		// Store given board in game.
		this.game.board = options.board || [];

		// Store id (given by the server).
		this.id = options.id

		// Update hash if the given room is not the room the user is in.
		if ( this.room !== options.room )
			location.hash = this.room = options.room;

		// Spawn all elements in the board.
		this.game.context.spawn_board( this.game.board );
	}
	// Event handler for the `onplayerget` event.
	, 'onplayerget' : function onplayerget( options )
	{
		var id = options.id;
		
		// If the event is from our own `Player`, return.
		if ( id === this.id )
			return;
		
		// Parse position.
		var position = JSON.parse( options.position )
		  , ctx = this.game.context
		  ;

		// If the otherPlayer is not instanciated yet, create it.
		if ( !ctx.otherPlayer )
		{
			position.source = game.player.data[ 'player' + position.number ];
			ctx.otherPlayer = new OtherPlayer( this.game, position );
		}

		// Update the otherPlayer with the given position.
		ctx.otherPlayer.update( position );
	}
}

// =============================================================================
// CONTEXT
// =============================================================================

// Context for the game.
var Context = function Context( game, options )
{
	// Store `Game`.
	this.game = game;

	// If `node` is not provided, use `document.body`.
	options.node || ( options.node = document.body );

	// Store `data`.
	this.data = options;

	// Create `canvas` element.
	this.create( options.node, options.width, options.height );

	// Load water, land and map images.
	this.water = new Drawing( game, { 'source' : options.water.source } );
	this.land = new Drawing( game, { 'source' : options.land.source } );
	this.map = new Drawing( game, { 'source' : options.map.source } );

	// Load avatars for player 1 and player 2.
	this.player1 = new Drawing( game, { 'source' : './asset/image/_player1.png' } )
	this.player2 = new Drawing( game, { 'source' : './asset/image/_player2.png' } )

	// Create new instance for both the Obstacle flock and the Power flock.
	this.obstacles = new Obstacles( game, options.obstacle || {} );
	this.powers = new Powers( game, options.power || {} );

	// Start listening for key events.
	this.listen();

	return this;
};

// Prototype for Context
Context.prototype = {
	  'create' : function create()
	{
		// Create `canvas` element;
		var canvas = document.createElement( 'canvas' )
		  , ctx    = canvas.getContext( '2d' )
		  ;

		// Set size of `canvas` element.
		canvas.width = this.data.width || 512;
		canvas.height = this.data.height || 480;

		// Store how many blocks fit on the screen.
		this.block_width = canvas.width / this.data.block;
		this.block_height = canvas.height / this.data.block;

		// Store the canvas' context.
		this.ctx = ctx;

		// Set default text styles for the canvas.
		ctx.fillStyle = 'white';
		ctx.font = '36px silkscreennormal, Helvetica';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';

		// Append element.
		this.data.node.appendChild( canvas );
	}
	, 'reset' : function reset()
	{
		// Reset absolute x and y positions.
		this.absolute_x = 0;
		this.absolute_y = 0;

		// Reset draw_count.
		this.draw_count = 0;
	}
	, 'spawn_board' : function spawn_board( elements )
	{
		var i = 0, element, l = elements.length, es;
		
		// For every element in elements...
		for ( ; i < l; i++ )
		{
			element = elements[ i ];

			es = this[ element.name + 's' ]

			// If there's a flock for it's name...
			if ( es )
			{
				// Spawn the element.
				es.spawn( element );
			}
		}
	}
	, 'draw' : function draw()
	{
		var _this = this
		  , game = this.game
		  , ctx = this.ctx
		  , water = this.water
		  , land = this.land
		  , map = this.map
		  , rock = this.rock
		  , player = game.player

		  , cw = ctx.canvas.width
		  , ch = ctx.canvas.height

		  , offsety = ( this.draw_count % this.data.block + 1 ) * game.speedy / 64
		  ;

		// If the water image is ready, draw the entire canvas with water 
		// blocks.
		if ( water.ready )
			game.set_blocks( water, 0, -8, this.block_width, this.block_height, 0, offsety );

		// If the land image is ready, draw the left- and right-most edge of 
		// the canvas with land blocks.
		if ( land.ready )
		{
			game.set_blocks( land, 0, -8, 1, this.block_height, 0, offsety );
			game.set_blocks( land, this.block_width - 1, -8, this.block_width, this.block_height, 0, offsety );
		}

		// If the map image is ready, draw it on the right-most edge of the 
		// canvas.
		if ( map.ready )
		{
			ctx.drawImage( map.node, this.data.width - map.width, 0 );
		}

		// If another player is connected...
		if ( this.otherPlayer )
		{
			var drawing = this[ 'player' + this.otherPlayer.data.number ]

			// ...draw it's avatar (if it's ready).
			if ( drawing.ready )
				ctx.drawImage( drawing.node, 0, this.data.height - drawing.height );

			// ...draw it's boat.
			this.otherPlayer.draw();
		}

		// If the Player's avatar is ready, draw it.
		if ( this[ 'player' + player.data.id ].ready )
			ctx.drawImage( this[ 'player' + player.data.id ].node, 0, 0 )

		// Call update on the Obstacle- and Power-flock.
		this.obstacles.update();
		this.powers.update();

		// Check all elements if they are in contact with the player.
		[].concat( this.obstacles.children, this.powers.children ).forEach( function callback( Element )
			{
				if ( _this.has_contact.call( _this, Element, player ) )
					_this.oncontact.call( _this, Element, player )
			}
		);

		// Draw current time on canvas.
		ctx.fillText( this.format_time( game.time.second ), this.data.width - this.data.block, 2 );

		// Update draw_count.
		this.draw_count++;
	}
	// Function that formats time in a string.
	, 'format_time' : function format_time( seconds )
	{
		var hours = 0, minutes = 0, arr = [];

		// Count hours.
		while ( seconds >= 3600 )
		{
			hours++;
			seconds -= 3600;
		}

		// Count minutes.
		while ( seconds >= 60 )
		{
			minutes++;
			seconds -= 60;
		}

		// If hours is more than zero, add hours.
		if ( hours > 0 )
			arr.push( hours );

		// If minutes is more than zero, add minutes. (Preceeded by a zero if 
		// needed).
		if ( minutes > 0 )
			arr.push( minutes > 9? minutes : '0' + minutes );

		// Add seconds. (Preceeded by a zero if needed).
		arr.push( seconds > 9? seconds : '0' + seconds );

		// Returned the joined hours, minutes and seconds.
		return arr.join( ':' );
	}
	// Store for currently pressed keys.
	, 'keys' : {}
	// Helper function to detect if a key is pressed.
	, 'is_pressed' : function is_pressed( key )
	{
		return this.keys[ key ] || false;
	}
	// Function that handles key up and down events.
	, 'listen' : function listen()
	{
		var _this = this;

		addEventListener(
			  'keydown'
			, function ( e )
			{
				_this.keys[ e.keyIdentifier ] = true;
			}
			, false
		);

		addEventListener(
			  'keyup'
			, function ( e )
			{
				_this.keys[ e.keyIdentifier ] = false;
			}
			, false
		);
	}
	// Helper function that checks if the boat can exist at a certain position.
	// Return true, false, or a certain maximal movement.
	, 'can_exist' : function can_exist( pos, _pos )
	{
		var ctx_w  = this.ctx.canvas.width
		  , margin = this.data.margin * ctx_w
		  , posx   = pos.x + _pos.x
		  , posy   = pos.y + _pos.y
		  , minx   = this.data.block
		  , maxx   = ( this.block_width - 1 ) * this.data.block
		  ;

		if ( posx > minx && posx < maxx )
			return _pos.x;

		if ( posx > minx && pos.x < maxx )
			return maxx - pos.x;

		if ( pos.x > minx && posx < maxx  )
			return minx - pos.x;

		return false;
	}
	// Detect if an Element is in contact with Player.
	, 'has_contact' : function has_contact( Element, Player )
	{
		return Player.left <= Element.right && Element.left <= Player.right && Player.top <= Element.bottom && Element.top <= Player.bottom;
	}
	// Calls oncontact on the Element.
	, 'oncontact' : function contact( Element, Player )
	{
		if ( Element.oncontact )
			Element.oncontact.call( Element, Player )
	}
};



// Other player in Game.
var OtherPlayer = function OtherPlayer( game, options )
{
	options || ( options = {} );
	this.game = game;
	this.data = options;

	var b = game.context.data.block;

	this.drawing = new Drawing( game, { 'source' : options.source } );

	this.block_x = 0;
	this.block_y = 0;
	this.offsetx = options.x;
	this.offsety = -options.y;

	return this;
}

// Prototype for OtherPlayer.
OtherPlayer.prototype = {
	// Update function. Gets called when a new position comes through the
	// Socket.
	'update' : function update( position )
	{
		var b = game.context.data.block;

		this.offsetx = position.x;
		this.offsety = ( ( this.game.context.absolute_y - position.y ) / b ) + ( 7 * b );
	}
	// Draw function. Draws the otherPlayeron the canvas.
	, 'draw' : function draw()
	{
		if ( this.drawing )
			this.game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );
	}
};



// =============================================================================
// PLAYER
// =============================================================================

// Player in game.
var Player = function Player( game, options )
{
	this.game = game;
	this.data = options;

	// Create drawing for player.
	this.drawing = new Drawing( game, { 'source' : options[ 'player' + options.id ] } );

	return this;
}

// Prototype of player.
Player.prototype = {
	// Draw player.
	'draw' : function draw()
	{
		// If the drawing is ready...
		if ( this.drawing.ready )
		{
			// Post position of player to Socket.
			this.post();

			// Draw playeron canvas.
			this.game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );
		}
	}
	// Post position.
	, 'post' : function post()
	{
		var s = this.game.socket;

		// If `Socket` or `Socket.emit` is not available, return.
		if ( !s || !s.emit )
			return;

		// Post this.toJSON() to `Socket`.
		s.emit( 'playerPost', {
			'position' : JSON.stringify( this.toJSON() )
		} );
	}
	// Create JSON object of the player.
	, 'toJSON' : function toJSON()
	{
		var ctx = this.game.context;

		return { 'x' : ctx.absolute_x, 'y' : ctx.absolute_y, 'number' : this.data.id };
	}
	// Update player.
	, 'update' : function update()
	{
		var game   = this.game
		  , ctx    = game.context
		  , delta  = game.time.delta

		  , b      = ctx.data.block
		  , ctx_w  = ctx.ctx.canvas.width
		  , right  = ctx.is_pressed( 'Right' )
		  , left   = ctx.is_pressed( 'Left' )
		  , up    = ctx.is_pressed( 'Up' )

		  , displacement, x, y, exist_left, exist_right
		  ;

		// If Player is not hitting on an object...
		if ( !this.contact )
		{
			// Set speed.
			game.speedy = game.temporary_speedy !== false
				? game.temporary_speedy
				: !up
					? ctx.data.speed / 2 * ctx.data.block
					: game.default_speed;
		}

		// If left or right are pressed.
		if ( left || right )
		{
			// Create displacement
			displacement = Math.round( 1.5 * game.speedx * delta );

			// Round displacement to an even number.
			if ( displacement % 2 === 1 )
				displacement--;

			// Create future x and y position.
			x = this.block_x * ctx.data.block + this.offsetx;
			y = this.block_y * ctx.data.block + this.offsety

			// Detect where the player can exist.
			exist_left = ctx.can_exist(
				  { 'x' : x, 'y' : y }
				, { 'x' : -displacement, 'y' : 0 }
			);

			exist_right = ctx.can_exist(
				  { 'x' : x + this.drawing.width, 'y' : y + this.drawing.height }
				, { 'x' : displacement, 'y' : 0 }
			);

			// If left is pressed and the player can move to the future 
			// position.
			if ( left && exist_left === true )
			{
				// Set position to future position.
				this.offsetx += -displacement;
			}
			// Else, if the player can exist left, but not fully at the future 
			// position...
			else if ( left && exist_left !== false )
			{
				// Set position to maximal possible position.
				this.offsetx += exist_left;
			}

			// If left is pressed and the player can move to the future 
			// position.
			if ( right && exist_right === true )
			{
				// Set position to future position.
				this.offsetx += displacement;
			}
			// Else, if the player can exist left, but not fully at the future 
			// position...
			else if ( right && exist_right !== false )
			{
				// Set position to maximal possible position.
				this.offsetx += exist_right;
			}
		}

		// If offsetx is more than or equal to a block's size...
		if ( this.offsetx >= b )
		{
			// Remove the block size from offsetx.
			this.offsetx -= b;
			// Add a block to block_x.
			this.block_x++;
		}
		// If offsetx is smaller than a block's size...
		else if ( this.offsetx < 0 )
		{
			// Add a blocksize, and add the offsetx.
			this.offsetx = b + this.offsetx;
			// Remove a block form block_x.
			this.block_x--;
		}

		// Call `update_position`.
		this.update_position();
	}
	, 'update_position' : function update_position()
	{
		var b = this.game.context.data.block
		  , left = this.block_x * b + this.offsetx
		  , top = this.block_y * b + this.offsety
		  ;

		// Set total length moved from zero point.
		// The zero point is at { 'x' : 0, 'y' : 0 }.
		this.game.context.absolute_x = left;
		this.game.context.absolute_y += this.game.speedy;

		// Store left, right, top and bottom in player for easier acces in 
		// `has_contact`.
		this.left = left;
		this.top = top;
		this.right = left + this.drawing.width;
		this.bottom = top + this.drawing.height;
	}
	, 'reset' : function reset()
	{
		// Reset the player.
		this.block_x = Math.floor( ( this.game.context.block_width ) / 2 );
		this.block_y = Math.floor( ( this.game.context.block_height ) / 4 * 3 );
		this.offsetx = 0;
		this.offsety = 0;
	}
	, 'contact' : null
}



// =============================================================================
// Drawing
// =============================================================================

// Prototype for each image.
var Drawing = function Drawing( game, options )
{
	// Store game and options.
	this.game = game;
	this.data = options;

	// Set source of image.
	this.set( options.source );

	return this;
}


Drawing.prototype = {
	  'ready' : false
	, 'node' : {}
	, 'onload' : function onload()
	{
		var canvas = document.createElement( 'canvas' )
		  , ctx    = canvas.getContext( '2d' )
		  , w      = this.node.width
		  , h      = this.node.height
		  , n      = this.node
		  ;

		canvas.width = w;
		canvas.height = h;
		ctx.drawImage( n, 0, 0 );

		// Store data of image on canvas.
		this.data = ctx.getImageData( 0, 0, w, h );

		// Set width, height and ready.
		this.width = w;
		this.height = h;
		this.ready = true;
	}
	, 'set' : function set( source )
	{
		var _this = this, n, _arguments = arguments;

		// Create new `Image` node.
		n = new Image();

		// Add this.onload to it's onload.
		n.onload = function onload(){ _this.onload.apply( _this, _arguments ) };

		// Set it's SRC.
		n.src = source;

		// Set `this.node` to the `Image`
		this.node = n;

		return this;
	}
}



// =============================================================================
// Elements
// =============================================================================

// Elements of context.
var Elements = function Elements( game, options )
{
	// Store game and options.
	this.game = game;
	this.data = options;

	// If multiple sources are provided...
	if ( Array.isArray( options.source ) )
	{
		var _drawing = this.drawing = [];

		// ...create multiple images.
		options.source.forEach( function callback( it, n, us )
			{
			 	_drawing[ n ] = new Drawing( game, { 'source' : it } );
			}
		);
	}
	// Else, if `options.drawing` is a string, create one Image.
	else if ( typeof options.drawing === 'string' )
	{
		this.drawing = new Drawing( game, { 'source' : options.drawing } );
	}

	return this;
}

// Prototype of Elements.
Elements.prototype = {
	// Spawn function. Spawns the Elements flock (depending on the Elements
	// Child).
	'spawn' : function spawn( options )
	{
		var drawing = this.drawing
		  , Child = this.Child
		  , b = this.game.context.data.block
		  ;

		// If `this.drawing` is an array, pick one image randomly.
		if ( Array.isArray( drawing ) )
			drawing = drawing[ Math.floor( Math.random() * drawing.length ) ];
		// Else, if the a drawing belonging to the Element's type exists, pick 
		// it.
		else if ( options.type && drawing[ options.type ] )
		{
			drawing = drawing[ options.type ];
		}

		// Set a few of the options over to _options.
		var _options = {
			  'block_x' : 0
			, 'block_y' : 0
			, 'offsetx' : options.x
			, 'offsety' : options.y
			, 'type' : options.type
			, 'name' : this.name || null
			, 'drawing' : drawing
		};

		// Create a new child with the new options.
		var it = new Child( this.game, _options );

		// Push the child to the flock's children.
		this.children.push( it );

		return it;
	}
	// Update children.
	, 'update' : function update()
	{
		var i = 0, l = this.children.length, _this = this;

		// For every child...
	    this.children.forEach( function callback( it, i )
			{
				// Call update on it.
				it.update();

				// If it should be removed, remove it.
				if ( _this.should_remove( it ) )
					delete _this.children[ i ];
			}
		);
	}
	// Detect if a child should be removed.
	, 'should_remove' : function should_remove( it )
	{
		return it.top > this.game.context.data.height
	}
};


	// =========================================================================
	// POWERS
	// =========================================================================

	// `Powers` of context. Inherits from the `Elements` flock.
	var Powers = function Powers( game, options )
	{
		// Create a new `Elements` flock.
		var _Elements = Elements.call( this, game, options );

		// Set the `Elements` drawing.
		_Elements.drawing = {
			  'up'   : new Drawing( game, { 'source' : options.up.source } )
			, 'down' : new Drawing( game, { 'source' : options.down.source } )
		};

		// Set the `Elements` Child to `Power`.
		_Elements.Child = Power;

		// Set the `Elements` name to `"power"`.
		_Elements.name = 'power';

		_Elements.children = [];

		// Return the instance of Elements.
		return _Elements;
	}

	// Set Powers.prototype.prototype to the Elements `prototype`.
	Powers.prototype = Object.create( Elements.prototype );

	// =========================================================================
	// OBSTACLES
	// =========================================================================

	// `Obstacles` of context. Inherits from the `Elements` flock.
	var Obstacles = function Obstacles( game, options )
	{
		// Create a new `Elements` flock.
		var _Elements = Elements.call( this, game, options );

		// Set the `Elements` Child to `Obstacle`.
		_Elements.Child = Obstacle;

		// Set the `Elements` name to `"obstacle"`.
		_Elements.name = 'obstacle';

		_Elements.children = [];

		return _Elements;
	}

	// Set Obstacles.prototype.prototype to the Elements `prototype`.
	Obstacles.prototype = Object.create( Elements.prototype );

// =============================================================================
// ELEMENT
// =============================================================================

// Element of Elements.
var Element = function Element( game, drawing, options )
{
	options || ( options = {} );

	// Store game and options.
	this.game = game;
	this.data = options;

	var b = game.context.data.block;

	// Store drawing
	this.drawing = drawing;

	// Set x and y position of Element.
	this.block_x = options.offsetx / b;
	this.block_y = 0;
	this.offsetx = 0;
	this.offsety = -options.offsety / b;

	return this;
}

// Prototype of Element
Element.prototype = {
	// Update function.
	'update' : function update()
	{
		var game = this.game
		  , ctx = game.context
		  , b = ctx.data.block
		  , left = this.block_x * b + this.offsetx
		  , top = this.block_y * b + this.offsety
		  ;

		// If the element is not in contact with the player...
		if ( !this.contact )
		{
			// ...calculate left, top, right, and bottom.
			this.left = left;
			this.top = top;
	  		this.right = left + this.drawing.width;
	  		this.bottom = top + this.drawing.height;

			// If offsety is more than or equal to block size...
			if ( this.offsety >= b )
			{
				// ...remove the size of a block from offsety.
				this.offsety -= b;
				// Add a block to block_y.
				this.block_y++;
			}

			// Update offsety of Element.
			this.offsety += game.speedy / 64
		}
		// Else, if the player just moved out of `Element`...
		else if ( !ctx.has_contact( this, game.player ) )
		{
			// ...and if `Element` has an onavoid function, call it.
			this.onavoid && this.onavoid( game.player );
		}

		// If Element's image is ready...
		if ( this.drawing.ready )
		{
			// Draw `Element`.
			game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );
		}
	}
	// Create JSON object of `Element`.
	, 'toJSON' : function toJSON()
	{
		return { 'name' : this.data.name, 'type' : this.data.type || null, 'x' : this.absolute_x, 'y' : this.absolute_y };
	}
	, 'topleft' : null
	, 'topright' : null
	, 'bottomleft' : null
	, 'bottomright' : null
	, 'contact' : null
	, 'remove' : function remove(){}
	, 'oncontact' : function contact(){}
	, 'onavoid' : function onavoid(){}
};



	// =========================================================================
	// POWER
	// =========================================================================

	// `Power` of `Powers`. Inherits from `Element`.
	var Power = function Power( game, options )
	{
		// Create a new Element.
		return Element.call( this, game, options.drawing, options );
	}

	// Set Power.prototype.prototype to `Element` prototype.
	Power.prototype = Object.create( Element.prototype );

	// Create oncontact function.
	Power.prototype.oncontact = function oncontact( Player )
	{
		// If there's a timout...
		if ( this.current_timout )
		{
			// ...clear it.
			clearTimeout( this.current_timout );
		}

		var game = this.game
		  , ctx = game.context
		  , s = ctx.data.speed * ctx.data.block
		  ;

		// Set a new temporary speed on game, depending on the type of the 
		// power.
		game.temporary_speedy = s * ( this.data.type === 'down'? 1 / 2 : 4 );

		// Set a timout to remove the temporary speed.
		this.current_timout = setTimeout( function callback()
			{
				game.temporary_speedy = false
			}, 4 * 1000
		);
	}


	// =========================================================================
	// OBSTACLE
	// =========================================================================

	// `Obstacle` of `Obstacles`. Inherits from `Element`.
	var Obstacle = function Obstacle( game, options )
	{
		// Create a new Element.
		return Element.call( this, game, options.drawing, options );
	}

	// Set Obstacle.prototype.prototype to `Element` prototype.
	Obstacle.prototype = Object.create( Element.prototype );

	// Create oncontact function.
	Obstacle.prototype.oncontact = function oncontact( Player )
	{
		// Set `this.contact` and `Player.contact` to true.
		this.contact = Player.contact = true;

		// Set `game.speedy` to 0.
		this.game.speedy = 0;
	}

	// Create onavoid function.
	Obstacle.prototype.onavoid = function onavoid( Player )
	{
		// Set `this.contact` and `Player.contact` to false.
		this.contact = Player.contact = false;

		// Set `game.speedy` to the default speed.
		this.game.speedy = this.game.default_speed;
	}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Create a new game.
window.game = new Game(
	{
		  'context' : {
			  'node'         : document.querySelector( '#app' )
			, 'width'        : 1152
			, 'block'        : 32
			, 'height'       : 320
			, 'speed'        : 4
			, 'water'        : {
				'source'     : './asset/image/water.png'
			}
			, 'land'         : {
				'source'     : './asset/image/land.png'
			}
			, 'map'         : {
				'source'     : './asset/image/map.png'
			}
			, 'power'        : {
				  'up'       : {
					'source' : './asset/image/power_up.png'
				}
				, 'down'     : {
					'source' : './asset/image/power_down.png'
				}
				, 'types'    : [ 'up', 'down' ]
			}
			, 'obstacle'     : {
				'source'     : [
					  './asset/image/rock.png'
					, './asset/image/rock.2.png'
					, './asset/image/rock.3.png'
				]
			}
		  }
  		, 'splashscreen' : {
  			'source'         : './asset/image/splash.png'
  		}
		, 'player' : {
			    'player1'    : './asset/image/player1.png'
			  , 'player2'    : './asset/image/player2.png'
		}
		, 'socket'           : {
			  'port'         : 1337
			, 'location'     : window.location.host
			, 'io'           : io || null
		}
	}
);

document.addEventListener( 'keydown', function( e )
	{
		// If `enter` is pressed and game is not started...
		if ( e.keyCode && e.keyCode === 13 && !game.is_started )
		{
			// ...start the game.
			game.start();
		}
	}
);