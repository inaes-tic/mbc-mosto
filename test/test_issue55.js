var melted = require('../api/Melted')

melted.start();

console.info("Melted is working:", melted.is_running());

melted.stop();

console.info("Melted is working:", melted.is_running());

setTimeout(function() {
	console.info("Melted is working:", melted.isRunning());
	}, 1500);
