const path = require('node:path');
const { parseArgs } = require('node:util');
const { deploy } = require('../src/deploy');

const USAGE = 'Usage: npm run deploy -- <path-to-your-project> [--force]';

/**
 * Parse the command line, deploy into the named project, and print what was written.
 * Relative paths resolve against the directory the user ran npm from (`INIT_CWD`),
 * not this repository, because `npm run` changes the working directory.
 * @param {string[]} argv - Arguments after the script name
 * @returns {number} Process exit code
 */
function main(argv) {
    let parsed;
    try {
        parsed = parseArgs({
            args: argv,
            options: {
                force: { type: 'boolean', default: false },
                help: { type: 'boolean', short: 'h', default: false }
            },
            allowPositionals: true
        });
    } catch (error) {
        console.error(`${error.message}\n${USAGE}`);
        return 1;
    }

    if (parsed.values.help) {
        console.log(USAGE);
        return 0;
    }
    if (parsed.positionals.length !== 1) {
        console.error(USAGE);
        return 1;
    }

    const baseDirectory = process.env.INIT_CWD || process.cwd();
    const targetDirectory = path.resolve(baseDirectory, parsed.positionals[0]);

    try {
        const writtenPaths = deploy({ targetDirectory, force: parsed.values.force });
        console.log(`Deployed into ${targetDirectory}:`);
        for (const writtenPath of writtenPaths) {
            console.log(`  ${path.relative(targetDirectory, writtenPath)}`);
        }
        return 0;
    } catch (error) {
        console.error(`Deploy failed: ${error.message}`);
        return 1;
    }
}

process.exitCode = main(process.argv.slice(2));
