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
	this.context = new Context( this, options.context || {} );
	this.player = new Player( this, options.player || {} );

	this.default_speed = options.speed || 200;
	this.speedx = this.default_speed;
	this.speedy = this.default_speed;

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
	, 'time' : {
		  'now' : null
		, 'delta' : null
		, 'then' : null
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

		this.time.after();
	}
	, 'start' : function start()
	{
		var _this = this;

		this.each( 'reset' );

		this.time.then = Date.now();

		setInterval( function(){ _this.draw.call( _this ) }, 1 );
		
		return this;
	}
	, 'set_block' : function set_block( b, x, y, offsetx, offsety )
	{
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

	this.obstacles = new Obstacles( game, options.obstacle || {} );
	this.powers = new Powers( game, options.power || {} );

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
		
		this.block_width = width / this.data.block;
		this.block_height = height / this.data.block;

		this.ctx = ctx;

		node.appendChild( canvas );
	}
	, 'draw' : function draw()
	{
		var _this = this
		  , ctx = this.ctx
		  , cw = ctx.canvas.width
		  , ch = ctx.canvas.height
		  , water = this.water
		  , land = this.land
		  , rock = this.rock
		  , offsety = ( this.draw_count % 32 + 1 ) * game.speedy / 100
		  ;

		if ( water.ready )
			this.game.set_blocks( water, 0, -4, this.block_width, this.block_height, 0, offsety );

		if ( land.ready )
		{
			this.game.set_blocks( land, 0, -4, 1, this.block_height, 0, offsety );
			this.game.set_blocks( land, this.block_width - 1, -4, this.block_width, this.block_height, 0, offsety );
		}

		if ( this.game.speedy !== 0 && this.draw_count % 32 === 0 )
		{
			if ( Math.random() < 0.5 )
				this.obstacles.spawn();
			else if ( Math.random() < 0.5 )
				this.powers.spawn();
		}
		

		// if ( this.game.player.speed !== 0 )
		// {
			this.obstacles.update();
			this.powers.update();

			[].concat( this.obstacles.children, this.powers.children ).forEach( function callback( Element )
				{
					if ( _this.has_contact.call( _this, Element, this.game.player ) )
						_this.oncontact.call( _this, Element, this.game.player )
				}
			);
		// }

		if ( game.speedy !== 0 )
			this.draw_count++;
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



// =============================================================================
// PLAYER
// =============================================================================

var Player = function Player( game, options )
{
	this.game = game;
	this.data = options;

	this.drawing = new Drawing( game, { 'source' : options.source } );

	return this;
}

Player.prototype = {
	  'draw' : function draw()
	{
		if ( this.drawing.ready )
			this.game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );

		// this.game.context.ctx.strokeRect( this.left, this.top, this.right - this.left, this.bottom - this.top )
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
			game.speedy = game.temporary_speedy !== false? game.temporary_speedy : !up? game.default_speed / 2 : game.default_speed;

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
	  'spawn' : function spawn()
	{
		var drawing = this.drawing, Child = this.Child
		  , t = this.data.types
		  , options = {}
		  ;

		if ( t )
			options.type = t[ Math.floor( Math.random() * t.length ) ];

		if ( Array.isArray( drawing ) )
			drawing = drawing[ Math.floor( Math.random() * drawing.length ) ];
		else if ( this.type && drawing[ this.type ] )
		{
			drawing = drawing[ this.type ];
			options.type = this.type;
		}

		options.x = Math.ceil( util.interpolate( Math.random(), 0, this.game.context.block_width - 2 ) );
		options.y = -1
		options.offsetx = 0
		options.offsety = 0

		this.children.push( new Child( this.game, drawing, options ) );
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

		return _Elements;
	}

	Obstacles.prototype = Object.create( Elements.prototype );

// =============================================================================
// ELEMENT
// =============================================================================

var Element = function Element( game, drawing, options )
{
	options || ( options = {} );
	this.game = game;

	if ( options.type )
		this.drawing = drawing[ options.type ]
	else
		this.drawing = drawing;

	this.block_x = options.x;
	this.block_y = options.y;
	this.offsetx = options.offsetx;
	this.offsety = options.offsety;
	this.data = options;

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

		if ( !this.contact )
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

			this.offsety += game.speedy / 100
		}
		else if ( !ctx.has_contact( this, game.player ) )
			this.onavoid && this.onavoid( game.player )

		game.set_block( this.drawing, this.block_x, this.block_y, this.offsetx, this.offsety );
		// this.game.context.ctx.strokeRect( this.left, this.top, this.right - this.left, this.bottom - this.top )
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

	var Power = function Power( game, drawing, options )
	{
		var _Element = Element.call( this, game, drawing, options );
		return _Element;
	}

	Power.prototype = Object.create( Element.prototype );
	Power.prototype.oncontact = function contact( Player )
	{
		if ( this.current_timout )
			clearTimeout( this.current_timout );

		var game = this.game;

		game.temporary_speedy = ( this.data.type === 'down'? game.default_speed / 2 : game.default_speed * 2 );

		this.current_timout = setTimeout( function callback()
			{
				game.temporary_speedy = false
			}, 4000
		);
	}


	// =========================================================================
	// OBSTACLE
	// =========================================================================

	var Obstacle = function Obstacle( game, drawing, options )
	{
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
			  'node'        : document.querySelector( '#app' )
			, 'width'       : 512
			, 'pixelblock'  : 2
			, 'block'       : 32
			, 'height'      : 384
			, 'water'   : {
				'source' : './asset/image/water.png'
			}
			, 'land'     : {
				'source' : './asset/image/land.png'
			}
			, 'power'   : {
				  'up'     : {
					'source' : './asset/image/power_up.png'
				}
				, 'down'   : {
					'source' : './asset/image/power_down.png'
				}
				, 'types'  : [ 'up', 'down' ]
			}
			, 'obstacle'   : {
				'source' : [
					  './asset/image/rock.png'
					, './asset/image/rock.2.png'
					, './asset/image/rock.3.png'
				]
			}
		  }
		, 'player' : {
			  'source'    : './asset/image/hero.png'
		}
	}
).start();
