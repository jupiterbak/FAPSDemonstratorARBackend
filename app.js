/*#####################################################################################*/
/* General options	
/*#####################################################################################*/
var http = require('http');
var express = require('express'),
	app = module.exports.app = express();
var bodyParser     =        require("body-parser");
var webserver = http.createServer(app);
var io = require('socket.io').listen(webserver);
var amqp = require('amqplib/callback_api');
var amqp_connection = null;
var amqp_ch = null;

var port = process.env.PORT || 8095;

const winston = require('winston');
const logger = winston.createLogger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.colorize({ all: true }),
        winston.format.printf((log) => {
            return `${log.timestamp} - [${log.level}] | [${log.service}] : ${log.message}`;
        })
    ),
    defaultMeta: { service: 'AR BACKEND' },
});

/*#####################################################################################*/
/* Socket IO
/*#####################################################################################*/

//SocketIO handler
io.on('connection', function (socket) {
	logger.info("Socket IO Connection");
	socket.on('disconnect', function(){
		logger.info("Socket IO Disconnection");
	});
});

/*#####################################################################################*/
/* AMQP CLIENT
/*#####################################################################################*/
// connect to brocker
amqp.connect("amqp://esys:esys@cloud.faps.uni-erlangen.de",function(err, conn) {
    if (err != null) {
        logger.error('AMQP Connection Error: ' + err.toString());
        return;
    }
    amqp_connection = conn;

    amqp_connection.on('error', function(err) {
        logger.error("AMQP Generated event 'error': " + err);
    });

    amqp_connection.on('close', function() {
        logger.info("AMQP Connection closed.");
        process.exit();
    });

    amqp_connection.createChannel(function(err, ch) {
        if (err != null) {
            logger.error('AMQP Chanel Error: ' + error.toString());
            return;
        }

        amqp_ch = ch;
        amqp_ch.assertExchange("FAPS_DEMONSTRATOR_LiveStreamData_MachineData", 'fanout', {durable: false});
        // test client
        amqp_ch.assertQueue('FAPS_DEMONSTRATOR_LiveStreamData_MachineData_ARBackend', {exclusive: false}, function(err, q) {
            if (err){
                logger.error('AMQP Queue Assertion Error: ' + err.toString());
            }else{
                //console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
                ch.bindQueue(q.queue, "FAPS_DEMONSTRATOR_LiveStreamData_MachineData", '');

                ch.consume(q.queue, function(msg) {
                    //console.log(" [x] %s", msg.content.toString());
                    _obj = JSON.parse(msg.content.toString());
                    io.emit('AMQPMachineData', JSON.stringify(_obj.value.data));                    

                }, {noAck: true});
            }
        });
    });
});

/*#####################################################################################*/
/*WEB Server		
/*#####################################################################################*/
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// main application
app.get('/', function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        state: 'OK'
    }));
});

webserver.listen(port, function () {
    logger.info('ARBACKEND app listening on port: ' + port);
});

process.on('uncaughtException', function(err) {
    logger.error('ARBACKEND app Uncaught Exception:' + err.stack);
    logger.error('ARBACKEND app server is on exit with code: ' + 1);
    webserver.close();
    process.exit(1);
});

// Stop the platform if the user request it
process.on('SIGINT', function() {
    logger.error('ARBACKEND app is on exit with code: ' + 0);
    webserver.close();
    process.exit(0);
});

process.on('exit', (code) => {
    logger.error('ARBACKEND app is on exit with code: ' + code);
    webserver.close();
    process.exit(0);
});

