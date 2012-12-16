var Game = function( options )
{
	this.data = options;
	this.context = new Context( this, options.context || {} );
	this.player = new Player( this, options.player || {} );
	return this;
};

var Context = function( game, options )
{
	options.margin = ( options.margin || 2 ) / 100;

	this.game = game;
	this.data = options;

	this.create( options.node, options.width, options.height );
	this.water = new Drawing( game, { 'source' : options.sourceWater } );
	this.land = new Drawing( game, { 'source' : options.sourceLand } );

	this.obstacles = new Obstacles( game, options.obstacle || {} );


	this.listen();
	this.draw_count = 0;
};

var Drawing = function( game, options )
{
	if ( typeof options.source !== 'string' )
	{
		var arr = [];

		options.source.forEach( function( it, n, us )
			{
				arr[ n ] = new Drawing( game, it );
			}
		);

		return arr;
	};

	this.game = game;
	this.data = options;

	this.set( options.source );
}

var Obstacles = function( game, options )
{
	this.game = game;
	var _drawing = this.drawing = [];

	if ( typeof options.source === 'string' )
		options.source = [ options.source ];

	options.source.forEach( function( it, n, us )
		{
		 	_drawing[ n ] = new Drawing( game, { 'source' : it } );
		}
	);

	this.data = options;
}

var Obstacle = function( game, drawing, frame, x, y )
{
	this.game = game;
	this.drawing = drawing;
	this.block_x = x;
	this.block_y = y;
	this.offsetx = 0;
	this.block_y = y;
	this.start_frame = frame;
}

Game.prototype = {
	'each' : function each( name )
	{
		if ( typeof name === 'string' )
		{
			name = [ name ];
		}

		var _this = this;

		name.forEach( function( it, n, us )
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

		setInterval( function(){ _this.draw.call( _this ) }, 30 );
		
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
			{
				this.set_block( b, xmin, ymin, offsetx, offsety );
			}
			xmin = _xmin;
		}
	}
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

Obstacles.prototype = {
	  'spawn' : function spawn( frame )
	{
		var drawing = this.drawing;

		if ( Array.isArray( drawing ) )
			drawing = drawing[ Math.floor( Math.random() * drawing.length ) ];

		

		var x = Math.round( Math.random() * ( this.game.context.block_width - 2 ) ) + 1
		this.obstacles.push( new Obstacle( this.game, drawing, frame, x, -1 ) );
	}
	, 'obstacles' : []
	, 'update' : function update( frame )
	{
		var i = 0, l = this.obstacles.length

		for ( ; i < l; i++ )
			this.obstacles[ i ].update( frame );
	}
};

Obstacle.prototype = {
	'update' : function update()
	{
		var game = this.game

		this.offsetx += game.context.data.pixelblock;

		game.set_block( this.drawing, this.block_x, this.block_y, 0, this.offsetx );
	}
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
		var ctx = this.ctx
		  , m = this.data.margin
		  , cw = ctx.canvas.width
		  , ch = ctx.canvas.height
		  , water = this.water
		  , land = this.land
		  , rock = this.rock
		  ;

		if ( water.ready )
		{
			this.game.set_blocks( water, 0, -1, this.block_width, this.block_height, 0, ( this.draw_count % 16 + 1 ) * 2 );
		}

		if ( land.ready )
		{
			this.game.set_blocks( land, 0, -1, 1, this.block_height, 0, ( this.draw_count % 16 + 1 ) * 2 );
			this.game.set_blocks( land, this.block_width - 1, -1, this.block_width, this.block_height, 0, ( this.draw_count % 16 + 1 ) * 2 );
		}

		if ( this.draw_count % 64 === 0 )
		{
			this.obstacles.spawn( this.draw_count );
		}

		this.obstacles.update( this.draw_count );

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
	, 'can_exist' : function can_exist( it, pos )
	{
		var ctx_w  = this.ctx.canvas.width
		  , it_w   = it.width
		  , margin = this.data.margin * ctx_w;

		return pos.x > margin && pos.x < ctx_w - it_w - margin
	}
};

var Player = function( game, options )
{
	this.game = game;
	this.data = options;

	this.drawing = new Drawing( game, { 'source' : options.source } );

	this.speed = options.speed || 256;
}

Player.prototype = {
	  'draw' : function draw()
	{
		var ctx = this.game.context, blockx, restx, blocky, resty;

		if ( this.drawing.ready )
		{
			  blockx = Math.floor( this.x / ctx.data.block )
			, restx  = this.x % ctx.data.block
			, blocky = Math.floor( this.y / ctx.data.block )
			, resty  = this.y % ctx.data.block
			;

			this.game.set_block( this.drawing, blockx, blocky, restx, resty );
		}
	}
	, 'update' : function update()
	{
		var ctx = this.game.context
		  , ctx_w   = ctx.ctx.canvas.width
		  , ctx_m   = ctx.data.margin
		  , delta   = this.game.time.delta
		  , displacement
		  , right = ctx.is_pressed( 'Right' )
		  , left = ctx.is_pressed( 'Left' )
		  ;

  		if ( left || right )
		{
			displacement = Math.round( this.speed * delta );

			if ( displacement % 2 === 1 )
				displacement--;

			if ( left && ctx.can_exist( this.drawing, { 'x' : this.x - this.speed * delta, 'y' : this.y } ) )
				this.x -= displacement;
			else if ( right && ctx.can_exist( this.drawing, { 'x' : this.x + this.speed * delta, 'y' : this.y } ) )
				this.x += displacement;
		}
	}
	, 'reset' : function reset()
	{
		var d = this.game.context.data;

		this.x = d.width / 2;
		this.y = d.height / 4 * 3;
	}
}

window.game = new Game(
	{
		  'context' : {
			  'margin'      : 2
			, 'node'        : document.querySelector( '#app' )
			, 'width'       : 512
			, 'pixelblock'  : 2
			, 'block'       : 32
			, 'height'      : 384
			, 'sourceWater' : './asset/image/water.png'
			, 'sourceLand'  : './asset/image/land.png'
			, 'obstacle'   : {
				'source' : [
					  './asset/image/rock.png'
					, './asset/image/rock.2.png'
					, './asset/image/rock.3.png'
				]
			}
			, 'sourceRock'  : './asset/image/rock.png'
		  }
		, 'player' : {
			  'source'    : './asset/image/hero.png'
		}
	}
).start();
