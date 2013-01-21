var http    = require( 'http' )
  , server  = http.createServer().listen( process.env.PORT || 1337 )
  , io      = require( 'socket.io' ).listen( server )
  ;

io.set( 'log level', 1 );
io.set( 'browser client minification', true );

var create_board = function create_board()
{
	_x = 36;
	_y = 10;
	
	elements = [];

	var i = 0;

	while ( i < 1000 )
	{
		var r = Math.ceil( Math.random() * 3 );

		while ( r-- > 0 )
		{
			if ( Math.random() < 0.25 )
			{
				elements.push( {
					  'name' : 'obstacle'
					, 'type' : null
					, 'x' : 32 + ( Math.floor( Math.random() * ( _x - 2 ) ) * 32 )
					, 'y' : i * 32 * 32
				} );
			}
			else if ( Math.random() < 0.1 )
			{
				elements.push( {
					  'name' : 'power'
					, 'type' : Math.random() > 0.5? 'up' : 'down'
					, 'x' : 32 + ( Math.floor( Math.random() * ( _x - 2 ) ) * 32 )
					, 'y' : i * 32 * 32
				} );
			}
		}
		
		i++;
	}

	return elements;
}

var board = create_board();

// When a user connects.
io.sockets.on( 'connection', function onconnection( socket )
	{
		var room;

		socket.on( 'knock', function onknock( options )
			{
				var l = io.sockets.clients( options.room ).length

				room = options.room && l < 2
					? options.room
					: Math.floor( Math.random() * 1000001 ).toString();

				if ( options.room !== room )
					l = 0;

				socket.join( room );
				socket.emit( 'invite', { 'room' : room, 'id' : socket.id, 'number' : l, 'board' : board } );
			}
		);

	  	socket.on( 'playerPost', function playerPost( options )
			{
				io.sockets.in( room ).emit( 'playerGet', {
					  'id'    : socket.id
					, 'position'   : options.position
				} );
		  	}
		);
	}
);