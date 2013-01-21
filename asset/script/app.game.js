window.requestAnimFrame = ( function()
	{
		return window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame    ||
			window.oRequestAnimationFrame      ||
			window.msRequestAnimationFrame     ||
			function( callback )
			{
				window.setTimeout( callback, 1000 / 60 );
			};
	}
	)();

// =============================================================================
// UTIL
// =============================================================================

var util = {
	  'interpolate' : function interpolate( weight, a, b )
	{
		return a + weight * ( b - a );
	}
	, 'difference' : function difference( a, b )
	{
		return Math.abs( a - b );
	}
}

// =============================================================================
// GAME
// =============================================================================

var Game = function Game( options )
{
	this.data = options;
	this.socket = new Socket( this, options.socket || {} );

	return this;
};

Game.prototype = {
	'each' : function each( name )
	{
		var _this = this;

		if ( typeof name === 'string' )
			name = [ name ];

		name.forEach( function callback( it, n, us )
			{
				if ( _this.context[ it ] )
					_this.context[ it ].apply( _this.context );

				if ( _this.player[ it ] )
					_this.player[ it ].apply( _this.player );
			}
		);
	}
	, 'init' : function init()
	{
		var options = this.data;
		this.context = new Context( this, options.context || {} );
		this.player = new Player( this, options.player || {} );

		this.screenshot = new Drawing( this, { 'source' : this.data.start.source } );

		this.default_speed = options.speed * this.context.data.block || 256;
		this.speedx = this.default_speed;
		this.speedy = this.default_speed;
	}
	, 'time' : {
		  'now' : null
  		, 'start' : null
		, 'delta' : null
		, 'then' : null
		, 'seconds' : null
		, 'before' : function start()
		{
			this.now = Date.now();
			this.delta = ( this.now - ( this.then || 0 ) ) / 1000;
		}
		, 'after' : function end()
		{
			this.then = this.now;
		}
	}
	, 'temporary_speedy' : false
	, 'draw' : function draw()
	{
		this.time.before();

		this.each( [ 'update', 'draw' ] );

		this.time.second = Math.floor( ( this.time.now - this.time.start ) / 1000 );
		this.time.after();
	}
	, 'reset' : function reset()
	{
		this.each( 'reset' );

		var _this = this;

		this.screenshot.onload = function onload()
		{
			_this.context.ctx.drawImage( _this.screenshot.node, 0, 0 );
			Drawing.prototype.onload.call( this, arguments );
		};

		return this;
	}
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
	, 'set_block' : function set_block( b, x, y, offsetx, offsety )
	{
		if ( x && y )
		offsetx || ( offsetx = 0 );
		offsety || ( offsety = 0 );

		this.context.ctx.drawImage( b.node, x * this.data.context.block + offsetx, y * this.data.context.block + offsety );
	}
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

var Socket = function Socket( game, options )
{
	var _this = this;

	this.game = game;
	this.room = window.location.hash.match( /\d+/ );
	this.room = this.room? +this.room[ 0 ] : null;
	
	this.connection = options.io.connect( 'ws://' + options.location + ':' + options.port );

	this.emit( 'knock', { 'room' : this.room } );

	this.on( 'invite', function(){ _this.oninvite.apply( _this, arguments ) } );
	this.on( 'playerPost', function(){ console.log( 'playerPost', arguments ); } );

	this.on( 'playerGet', function( options ){ return _this.onplayerGet( options ) } );
}

Socket.prototype = {
	  '_call' : function call( type, args )
	{
		if ( !this.connection || !this.connection[ type ] )
			return;

		return this.connection[ type ].apply( this.connection, args );
	}
	, 'emit' : function emit( key, value ){ return this._call( 'emit', [ key, value ] ) }
	, 'on' : function on( key, callback ){ return this._call( 'on', [ key, callback ] ) }
	, 'oninvite' : function oninvite( options )
	{
		this.game.data.player.id = options.number + 1
		this.game.init();
		this.game.reset();
		
		this.game.board = options.board || [];

		this.id = options.id

		if ( this.room !== options.room )
			location.hash = this.room = options.room;

		this.game.context.spawn_board( this.game.board );
	}
	, 'onplayerGet' : function onplayerGet( options )
	{
		var id = options.id
		  , position = JSON.parse( options.position )
		  , ctx = this.game.context
		  ;

		if ( id !== this.id )
		{
			if ( !ctx.otherPlayer )
			{
				position.source = game.player.data[ 'player' + position.number ];
				ctx.otherPlayer = new OtherPlayer( this.game, position );
			}

			ctx.otherPlayer.update( position );
		}
	}
}

// =============================================================================
// CONTEXT
// =============================================================================

var Context = function Context( game, options )
{
	this.game = game;
	options.node || ( options.node = document.body );
	this.data = options;

	this.create( options.node, options.width, options.height );

	this.water = new Drawing( game, { 'source' : options.water.source } );
	this.land = new Drawing( game, { 'source' : options.land.source } );

	this.map = new Drawing( game, { 'source' : options.map.source } );

	this.player1 = new Drawing( game, { 'source' : './asset/image/_player1.png' } )
	this.player2 = new Drawing( game, { 'source' : './asset/image/_player2.png' } )


	this.obstacles = new Obstacles( game, options.obstacle || {} );
	this.powers = new Powers( game, options.power || {} );

	this.absolute_x = 0;
	this.absolute_y = 0;

	this.listen();
	this.draw_count = 0;

	return this;
};

Context.prototype = {
	  'create' : function create( node, width, height )
	{
		var canvas = document.createElement( 'canvas' )
		  , ctx    = canvas.getContext( '2d' )
		  ;

		canvas.width = width || 512;
		canvas.height = height || 480;

		this.block_width = canvas.width / this.data.block;
		this.block_height = canvas.height / this.data.block;

		this.ctx = ctx;

		node.appendChild( canvas );
	}
	, 'spawn_board' : function spawn_board( board )
	{
		var i = 0, element, l = board.length, es;
		
		for ( ; i < l; i++ )
		{
			element = board[ i ];
			es = this[ element.name + 's' ]

			if ( es )
				Child = es.spawn( element );
		}
	}
	, 'draw' : function draw()
	{
		var _this = this
		  , game = this.game
		  , ctx = this.ctx
		  , cw = ctx.canvas.width
		  , ch = ctx.canvas.height
		  , water = this.water
		  , land = this.land
		  , map = this.map
		  , rock = this.rock
		  , offsety = ( this.draw_count % this.data.block + 1 ) * game.speedy / 64
		  ;

		if ( water.ready )
			game.set_blocks( water, 0, -8, this.block_width, this.block_height, 0, offsety );

		if ( land.ready )
		{
			game.set_blocks( land, 0, -8, 1, this.block_height, 0, offsety );
			game.set_blocks( land, this.block_width - 1, -8, this.block_width, this.block_height, 0, offsety );
		}
		
		if ( map.ready )
		{
			ctx.drawImage( map.node, this.data.width - map.width, 0 );
		}

		this.obstacles.update();
		this.powers.update();

		[].concat( this.obstacles.children, this.powers.children ).forEach( function callback( Element )
			{
				if ( _this.has_contact.call( _this, Element, game.player ) )
					_this.oncontact.call( _this, Element, game.player )
			}
		);

		if ( game.speedy !== 0 )
			this.draw_count++;

		if ( this.otherPlayer )
		{
			var drawing = this[ 'player' + this.otherPlayer.data.number ]
			ctx.drawImage( drawing.node, 0, this.data.height - drawing.height );
			this.otherPlayer.draw();
		}

		if ( this[ 'player' + game.player.data.id ].ready )
			ctx.drawImage( this[ 'player' + game.player.data.id ].node, 0, 0 )

		ctx.fillStyle = 'rgb(250, 250, 250)';
		ctx.font = '24px silkscreennormal, Helvetica';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'top';
		ctx.fillText( this.format_time( game.time.second ), this.data.width - this.data.block, 2 );
	}
	, 'format_time' : function format_time( seconds )
	{
		var hours = 0, minutes = 0, arr = [];

		while ( seconds >= 3600 )
		{
			hours++;
			seconds -= 3600;
		}

		while ( seconds >= 60 )
		{
			minutes++;
			seconds -= 60;
		}
		
		if ( hours > 0 )
			arr.push( hours )
		if ( minutes > 0 )
			arr.push( minutes > 9? minutes : '0' + minutes )

		arr.push( seconds > 9? seconds : '0' + seconds )
		return arr.join( ':' );
	}
	, 'keys' : {}
	, 'is_pressed' : function is_pressed( key )
	{
		return this.keys[ key ] || false;
	}
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
	, 'has_contact' : function has_contact( Element, Player )
	{
		return Player.left <= Element.right && Element.left <= Player.right && Player.top <= Element.bottom && Element.top <= Player.bottom;
	}
	, 'oncontact' : function contact( Element, Player )
	{
		if ( Element.oncontact )
			Element.oncontact.call( Element, Player )
	}
};



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

OtherPlayer.prototype = {
	  'update' : function update( position )
	{
		var b = game.context.data.block;

		this.offsetx = position.x;
		this.offsety = ( ( this.game.context.absolute_y - position.y ) / b ) + ( 7 * b );
	}
	, 'draw' : function draw()
	{
		if ( this.drawing )
			this.game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );
	}
};



// =============================================================================
// PLAYER
// =============================================================================

var Player = function Player( game, options )
{
	this.game = game;
	this.data = options;

	this.drawing = new Drawing( game, { 'source' : options[ 'player' + options.id ] } );

	return this;
}

Player.prototype = {
	  'draw' : function draw()
	{
		if ( this.drawing.ready )
		{
			this.post();
			this.game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );
		}
	}
	, 'post' : function post()
	{
		var s = this.game.socket;

		if ( !s || !s.emit )
			return;

		s.emit( 'playerPost', {
			'position' : JSON.stringify( this.toJSON() )
		} );
	}
	, 'toJSON' : function toJSON()
	{
		var ctx = this.game.context;

		return { 'x' : ctx.absolute_x, 'y' : ctx.absolute_y, 'number' : this.data.id };
	}
	, 'update' : function update()
	{
		var game   = this.game
		  , ctx    = game.context
		  , b      = ctx.data.block
		  , ctx_w  = ctx.ctx.canvas.width
		  , delta  = game.time.delta
		  , right  = ctx.is_pressed( 'Right' )
		  , left   = ctx.is_pressed( 'Left' )
		  , up    = ctx.is_pressed( 'Up' )
		  , displacement, x, y, exist_left, exist_right
		  ;

		if ( !this.contact )
		{
			game.speedy = game.temporary_speedy !== false
				? game.temporary_speedy
				: !up
					? ctx.data.speed / 2 * ctx.data.block
					: game.default_speed;
		}

		if ( left || right )
		{
			displacement = Math.round( 1.5 * game.speedx * delta );

			if ( displacement % 2 === 1 )
				displacement--;

			x = this.block_x * ctx.data.block + this.offsetx;
			y = this.block_y * ctx.data.block + this.offsety

			exist_left = ctx.can_exist(
				  { 'x' : x, 'y' : y }
				, { 'x' : -displacement, 'y' : 0 }
			);

			exist_right = ctx.can_exist(
				  { 'x' : x + this.drawing.width, 'y' : y + this.drawing.height }
				, { 'x' : displacement, 'y' : 0 }
			);

			if ( left && exist_left === true )
				this.offsetx += -displacement;
			else if ( left && exist_left !== false )
				this.offsetx += exist_left;

			if ( right && exist_right === true )
				this.offsetx += displacement;
			else if ( right && exist_right !== false )
				this.offsetx += exist_right;
		}

		if ( this.offsetx >= b )
		{
			this.offsetx -= b;
			this.block_x++;
		}
		else if ( this.offsetx < 0 )
		{
			this.offsetx = b + this.offsetx;
			this.block_x--;
		}

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

		this.left = left;
		this.top = top;
		this.right = left + this.drawing.width;
		this.bottom = top + this.drawing.height;
	}
	, 'reset' : function reset()
	{
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

var Drawing = function Drawing( game, options )
{
	if ( typeof options.source !== 'string' )
	{
		var arr = [];

		options.source.forEach( function calback( it, n, us )
			{
				arr[ n ] = new Drawing( game, it );
			}
		);

		return arr;
	};

	this.game = game;
	this.data = options;

	this.set( options.source );

	return this;
}


Drawing.prototype = {
	  'ready' : false
	, 'node' : {}
	, 'onload' : function on_load( source )
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

		this.data = ctx.getImageData( 0, 0, w, h );
		this.width = w;
		this.height = h;
		this.ready = true;
	}
	, 'set' : function set( source )
	{
		var _this = this, n, _arguments = arguments;

		n = new Image();
		n.onload = function on_load (){ _this.onload.apply( _this, _arguments ) };
		n.src = source;
			
		this.node = n;

		return this;
	}
}



// =============================================================================
// Elements
// =============================================================================

var Elements = function Elements( game, options )
{
	this.game = game;
	this.data = options;

	if ( Array.isArray( options.source ) )
	{
		var _drawing = this.drawing = [];

		options.source.forEach( function callback( it, n, us )
			{
			 	_drawing[ n ] = new Drawing( game, { 'source' : it } );
			}
		);
	}
	else if ( typeof options.drawing === 'string' )
	{
		this.drawing = new Drawing( game, { 'source' : options.drawing } );
	}

	return this;
}

Elements.prototype = {
	  'spawn' : function spawn( options )
	{
		var drawing = this.drawing
		  , Child = this.Child
		  , _options = {}
		  , b = this.game.context.data.block
		  ;

		if ( options.type )
			_options.type = options.type;

		if ( Array.isArray( drawing ) )
			drawing = drawing[ Math.floor( Math.random() * drawing.length ) ];
		else if ( options.type && drawing[ options.type ] )
		{
			drawing = drawing[ options.type ];
			_options.type = options.type;
		}

		_options.block_x = 0
		_options.block_y = 0
		_options.offsetx = options.x
		_options.offsety = options.y
		
		_options.name = this.name || null;

		_options.drawing = drawing;

		var child = new Child( this.game, _options );

		this.children.push( child );

		return child;
	}
	, 'update' : function update()
	{
		var i = 0, l = this.children.length, Child, _this = this;

	    this.children.forEach( function callback( Child, i )
			{
				Child.update();

				if ( _this.should_remove( Child ) )
					delete _this.children[ i ];
			}
		);
	}
	, 'should_remove' : function should_remove( Child )
	{
		return Child.top > this.game.context.data.height
	}
};


	// =========================================================================
	// POWERS
	// =========================================================================

	var Powers = function Powers( game, options )
	{
		var _Elements = Elements.call( this, game, options );

		_Elements.drawing = {
			  'up'   : new Drawing( game, { 'source' : options.up.source } )
			, 'down' : new Drawing( game, { 'source' : options.down.source } )
		};

		_Elements.Child = Power;
		_Elements.children = [];

		_Elements.name = 'power';

		return _Elements;
	}

	Powers.prototype = Object.create( Elements.prototype );

	// =========================================================================
	// OBSTACLES
	// =========================================================================

	var Obstacles = function Obstacles( game, options )
	{
		var _Elements = Elements.call( this, game, options );
		_Elements.Child = Obstacle;
		_Elements.children = [];

		_Elements.name = 'obstacle';

		return _Elements;
	}

	Obstacles.prototype = Object.create( Elements.prototype );

// =============================================================================
// ELEMENT
// =============================================================================

var arr = [];

var Element = function Element( game, drawing, options )
{
	options || ( options = {} );
	this.game = game;
	this.data = options;

	var b = game.context.data.block;

	this.drawing = drawing;

	this.block_x = options.offsetx / b;
	this.block_y = 0;
	this.offsetx = 0;
	this.offsety = -options.offsety / b;

	arr.push( this.block_x );

	return this;
}

Element.prototype = {
	'update' : function update()
	{
		var game = this.game
		  , ctx = game.context
		  , b = ctx.data.block
		  , left = this.block_x * b + this.offsetx
		  , top = this.block_y * b + this.offsety
		  ;

		if ( !this.contact && this.drawing )
		{
			this.left = left;
			this.top = top;
	  		this.right = left + this.drawing.width;
	  		this.bottom = top + this.drawing.height;

			if ( this.offsety >= b )
			{
				this.offsety -= b;
				this.block_y++;
			}

			this.offsety += game.speedy / 64
		}
		else if ( !ctx.has_contact( this, game.player ) )
			this.onavoid && this.onavoid( game.player )

		if ( this.drawing )
		{
			game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );
		}
	}
	, 'toJSON' : function toJSON()
	{
		return { 'name' : this.data.name, 'type' : this.data.type || null, 'x' : this.absolute_x, 'y' : this.absolute_y };
	}
	, 'remove' : function remove()
	{}
	, 'topleft' : null
	, 'topright' : null
	, 'bottomleft' : null
	, 'bottomright' : null
	, 'contact' : null
	, 'oncontact' : function contact(){}
};



	// =========================================================================
	// POWER
	// =========================================================================

	var Power = function Power( game, options )
	{
		var drawing = options.drawing;
		var _Element = Element.call( this, game, drawing, options );
		return _Element;
	}

	Power.prototype = Object.create( Element.prototype );
	Power.prototype.oncontact = function contact( Player )
	{
		if ( this.current_timout )
			clearTimeout( this.current_timout );

		var game = this.game, ctx = game.context, s = ctx.data.speed * ctx.data.block;

		game.temporary_speedy = s * ( this.data.type === 'down'? 1 / 2 : 4 );

		this.current_timout = setTimeout( function callback()
			{
				game.temporary_speedy = false
			}, 4 * 1000
		);
	}


	// =========================================================================
	// OBSTACLE
	// =========================================================================

	var Obstacle = function Obstacle( game, options )
	{
		var drawing = options.drawing;

		return Element.call( this, game, drawing, options );
	}

	Obstacle.prototype = Object.create( Element.prototype );

	Obstacle.prototype.oncontact = function contact( Player )
	{
		this.contact = Player.contact = true;
		this.game.speedy = 0;
		
		if ( this.data.type !== 'down' )
			this.game.temporary_speedy = false
	}

	Obstacle.prototype.onavoid = function avoid( Player )
	{
		this.contact = Player.contact = false;
		this.game.speedy = this.game.default_speed;
	}

// =============================================================================
// INITIALIZATION
// =============================================================================

window.game = new Game(
	{
		  'context' : {
			  'node'         : document.querySelector( '#app' )
			, 'width'        : 1152
			, 'pixelblock'   : 2
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
  		, 'start' : {
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
		if ( e.keyCode && e.keyCode === 13 && !game.is_started )
		{
			game.start();
		}
	}
);
 