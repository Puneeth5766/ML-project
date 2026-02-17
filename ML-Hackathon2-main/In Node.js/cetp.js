const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { startServer } = require('./server');
const { startClient } = require('./client');

yargs(hideBin(process.argv))
    .command(
        'server [port]',
        'Start the CETP receiver server',
        (yargs) => {
            return yargs.positional('port', {
                describe: 'Port to bind on',
                default: 8888,
                type: 'number'
            });
        },
        (argv) => {
            console.log(`Starting Server on port ${argv.port}...`);
            startServer(argv.port);
        }
    )
    .command(
        'send <file>',
        'Send a file or folder to a CETP server',
        (yargs) => {
            yargs
                .positional('file', {
                    describe: 'Path to file or folder to send',
                    type: 'string'
                })
                .option('ip', {
                    alias: 'h',
                    type: 'string',
                    description: 'Server IP address',
                    default: 'localhost'
                })
                .option('port', {
                    alias: 'p',
                    type: 'number',
                    description: 'Server port',
                    default: 8888
                });
        },
        async (argv) => {
            try {
                await startClient(argv.file, argv.ip, argv.port);
            } catch (err) {
                console.error("Transfer failed:", err.message);
                process.exit(1);
            }
        }
    ) // Add a default command or explicit instructions
    .demandCommand(1, 'You must provide a valid command (server or send)')
    .help()
    .parse();
