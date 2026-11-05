const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const AGENTS_SOURCE_DIR = path.join(REPOSITORY_ROOT, 'agents');
const SKILLS_SOURCE_DIR = path.join(REPOSITORY_ROOT, 'skills', 'shared');

/**
 * Instruction files copied from `agents/` to the root of the target project.
 * Claude Code reads `CLAUDE.md`; GitHub Copilot reads `AGENTS.md`.
 * @type {ReadonlyArray<string>}
 */
const INSTRUCTION_FILE_NAMES = Object.freeze(['CLAUDE.md', 'AGENTS.md']);

/**
 * Project-level skills directory, relative to the target project root.
 * Claude Code and GitHub Copilot both discover project skills here.
 */
const SKILLS_TARGET_RELATIVE_DIR = path.join('.claude', 'skills');

/**
 * @typedef {object} CopyEntry
 * @property {string} source - Absolute source path inside this repository
 * @property {string} destination - Absolute destination path inside the target project
 * @property {boolean} isDirectory - Whether the entry is a directory (a skill) rather than a file
 */

/**
 * List every skill under `skills/shared/` that contains a `SKILL.md` file.
 * @param {string} skillsSourceDir - Directory holding one subdirectory per skill
 * @returns {string[]} Skill directory names, sorted alphabetically
 */
function listSkillNames(skillsSourceDir) {
    return fs.readdirSync(skillsSourceDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => fs.existsSync(path.join(skillsSourceDir, entry.name, 'SKILL.md')))
        .map((entry) => entry.name)
        .sort();
}

/**
 * Reject targets that would turn a project deploy into a global one or overwrite this repository.
 * @param {string} targetDirectory - Absolute path of the project to deploy into
 * @param {string} homeDirectory - Absolute path of the current user's home directory
 * @returns {void}
 * @throws {Error} When the target is missing, not a directory, the home directory,
 *     the filesystem root, or this repository
 */
function validateTargetDirectory(targetDirectory, homeDirectory) {
    if (!fs.existsSync(targetDirectory)) {
        throw new Error(`Target project does not exist: ${targetDirectory}`);
    }
    if (!fs.statSync(targetDirectory).isDirectory()) {
        throw new Error(`Target project is not a directory: ${targetDirectory}`);
    }

    const realTarget = fs.realpathSync(targetDirectory);
    if (realTarget === path.parse(realTarget).root) {
        throw new Error('Refusing to deploy into the filesystem root.');
    }
    if (fs.existsSync(homeDirectory) && realTarget === fs.realpathSync(homeDirectory)) {
        throw new Error('Refusing to deploy into the home directory; this tool only deploys into a project.');
    }
    if (realTarget === fs.realpathSync(REPOSITORY_ROOT)) {
        throw new Error('Refusing to deploy into this repository; pass the path of another project.');
    }
}

/**
 * Build the list of files and skill directories to copy into the target project.
 * @param {string} targetDirectory - Absolute path of the project to deploy into
 * @returns {CopyEntry[]} Copy entries in deployment order
 */
function buildCopyEntries(targetDirectory) {
    const instructionEntries = INSTRUCTION_FILE_NAMES.map((fileName) => ({
        source: path.join(AGENTS_SOURCE_DIR, fileName),
        destination: path.join(targetDirectory, fileName),
        isDirectory: false
    }));

    const skillEntries = listSkillNames(SKILLS_SOURCE_DIR).map((skillName) => ({
        source: path.join(SKILLS_SOURCE_DIR, skillName),
        destination: path.join(targetDirectory, SKILLS_TARGET_RELATIVE_DIR, skillName),
        isDirectory: true
    }));

    return [...instructionEntries, ...skillEntries];
}

/**
 * Copy the agent instruction files and shared skills into one project.
 * Nothing is written when any destination already exists and `force` is false.
 * @param {object} options - Deployment options
 * @param {string} options.targetDirectory - Path of the project to deploy into
 * @param {boolean} [options.force=false] - Replace existing instruction files and skill directories
 * @param {string} [options.homeDirectory=os.homedir()] - Home directory to refuse as a target
 * @returns {string[]} Absolute destination paths that were written
 * @throws {Error} When the target is invalid or a destination exists without `force`
 */
function deploy({ targetDirectory, force = false, homeDirectory = os.homedir() }) {
    if (typeof targetDirectory !== 'string' || targetDirectory.trim() === '') {
        throw new Error('A target project path is required.');
    }

    const resolvedTarget = path.resolve(targetDirectory);
    validateTargetDirectory(resolvedTarget, homeDirectory);

    const copyEntries = buildCopyEntries(resolvedTarget);
    const existingDestinations = copyEntries
        .map((entry) => entry.destination)
        .filter((destination) => fs.existsSync(destination));

    if (existingDestinations.length > 0 && !force) {
        throw new Error(
            `These paths already exist; re-run with --force to replace them:\n  ${existingDestinations.join('\n  ')}`
        );
    }

    for (const entry of copyEntries) {
        fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
        if (entry.isDirectory) {
            // Replace the whole skill directory so files removed from the source do not linger.
            fs.rmSync(entry.destination, { recursive: true, force: true });
            fs.cpSync(entry.source, entry.destination, { recursive: true });
        } else {
            fs.copyFileSync(entry.source, entry.destination);
        }
    }

    return copyEntries.map((entry) => entry.destination);
}

module.exports = {
    AGENTS_SOURCE_DIR,
    INSTRUCTION_FILE_NAMES,
    SKILLS_SOURCE_DIR,
    SKILLS_TARGET_RELATIVE_DIR,
    deploy,
    listSkillNames
};
