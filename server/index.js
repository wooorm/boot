// Require `http`.
var http    = require( 'http' )
  // Create a HTTP server.
  , server  = http.createServer().listen( process.env.PORT || 1337 )
  // Require `socket.io`, and listen to the server.
  , io      = require( 'socket.io' ).listen( server )
  ;

// Set `socket.io`s `log level` to `1` (almost no debug messages).
io.set( 'log level', 1 );

// Set `socket.io`s `browser client minification` to true (minifying client 
// files).
io.set( 'browser client minification', true );

// Creates a board function
var create_board = function create_board()
{
	// Block width.
	var _x = 36
	// Block height.
	  , _y = 10
	// Store elements.
	  , elements = []
	// Iterator.
	  , i = 0
	  ;

	// Loop 1000 times.
	while ( i < 1000 )
	{
		// Random integer; 1, 2, or 3.
		var r = Math.ceil( Math.random() * 3 );

		// Loop 1, 2, or 3 times.
		while ( r-- > 0 )
		{
			if ( Math.random() < 0.25 )
			{
				// Create a new obstacle.
				elements.push( {
					  'name' : 'obstacle'
					, 'type' : null
					, 'x' : 32 + ( Math.floor( Math.random() * ( _x - 2 ) ) * 32 )
					, 'y' : i * 32 * 32
				} );
			}
			else if ( Math.random() < 0.1 )
			{
				// Create a new power.
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


// Create a new board.
var board = create_board();

// When a user connects.
io.sockets.on( 'connection', function onconnection( socket )
	{
		var room;

		// On knock.
		socket.on( 'knock', function onknock( options )
			{
				var l = io.sockets.clients( options.room ).length

				// If the room is not full, room is the clients room. Else,
				// generate a new room number.
				room = options.room && l < 2
					? options.room
					: Math.floor( Math.random() * 1000001 ).toString();

				// If the clients room is full, reset `l` to `0`.
				if ( options.room !== room )
					l = 0;

				// Join the client in the room.
				socket.join( room );

				// Emit an `invite` event.
				socket.emit( 'invite', {
					  'room' : room
					, 'id' : socket.id
					, 'number' : l
					, 'board' : board
				} );
			}
		);

		// On post.
	  	socket.on( 'playerPost', function playerPost( options )
			{
				// Emit a `playerGet` event.
				io.sockets.in( room ).emit( 'playerGet', {
					  'id'       : socket.id
					, 'position' : options.position
				} );
		  	}
		);
	}
);