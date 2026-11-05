const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    AGENTS_SOURCE_DIR,
    INSTRUCTION_FILE_NAMES,
    SKILLS_SOURCE_DIR,
    SKILLS_TARGET_RELATIVE_DIR,
    deploy,
    listSkillNames
} = require('../src/deploy');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const DEPLOY_BIN = path.join(REPOSITORY_ROOT, 'bin', 'deploy.js');

/**
 * Create an empty temporary directory that is removed when the test finishes.
 * @param {import('node:test').TestContext} t - Test context used to register clean-up
 * @returns {string} Absolute path of the new directory
 */
function createTempDirectory(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'coding-ai-agents-public-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}

/**
 * Create a temporary project directory and a separate fake home directory.
 * @param {import('node:test').TestContext} t - Test context used to register clean-up
 * @returns {{ projectDirectory: string, homeDirectory: string }} Absolute paths of both directories
 */
function createProjectAndHome(t) {
    const rootDirectory = createTempDirectory(t);
    const projectDirectory = path.join(rootDirectory, 'project');
    const homeDirectory = path.join(rootDirectory, 'home');
    fs.mkdirSync(projectDirectory);
    fs.mkdirSync(homeDirectory);
    return { projectDirectory, homeDirectory };
}

test('deploy', async (t) => {
    await t.test('copies both instruction files and every shared skill into the project', (t) => {
        const { projectDirectory, homeDirectory } = createProjectAndHome(t);

        deploy({ targetDirectory: projectDirectory, homeDirectory });

        for (const fileName of INSTRUCTION_FILE_NAMES) {
            assert.strictEqual(
                fs.readFileSync(path.join(projectDirectory, fileName), 'utf8'),
                fs.readFileSync(path.join(AGENTS_SOURCE_DIR, fileName), 'utf8')
            );
        }
        for (const skillName of listSkillNames(SKILLS_SOURCE_DIR)) {
            assert.strictEqual(
                fs.readFileSync(path.join(projectDirectory, SKILLS_TARGET_RELATIVE_DIR, skillName, 'SKILL.md'), 'utf8'),
                fs.readFileSync(path.join(SKILLS_SOURCE_DIR, skillName, 'SKILL.md'), 'utf8')
            );
        }
    });

    await t.test('writes nothing when a destination already exists and force is not set', (t) => {
        const { projectDirectory, homeDirectory } = createProjectAndHome(t);
        const existingClaudeFile = path.join(projectDirectory, 'CLAUDE.md');
        fs.writeFileSync(existingClaudeFile, 'Existing project rules\n');

        assert.throws(
            () => deploy({ targetDirectory: projectDirectory, homeDirectory }),
            /already exist.*--force/s
        );
        assert.strictEqual(fs.readFileSync(existingClaudeFile, 'utf8'), 'Existing project rules\n');
        assert.strictEqual(fs.existsSync(path.join(projectDirectory, 'AGENTS.md')), false);
        assert.strictEqual(fs.existsSync(path.join(projectDirectory, SKILLS_TARGET_RELATIVE_DIR)), false);
    });

    await t.test('replaces existing files and stale skill contents when force is set', (t) => {
        const { projectDirectory, homeDirectory } = createProjectAndHome(t);
        const [firstSkillName] = listSkillNames(SKILLS_SOURCE_DIR);
        const deployedSkillDirectory = path.join(projectDirectory, SKILLS_TARGET_RELATIVE_DIR, firstSkillName);
        const staleSkillFile = path.join(deployedSkillDirectory, 'stale.md');
        fs.writeFileSync(path.join(projectDirectory, 'CLAUDE.md'), 'Old rules\n');
        fs.mkdirSync(deployedSkillDirectory, { recursive: true });
        fs.writeFileSync(staleSkillFile, 'Left over from an earlier deploy\n');

        deploy({ targetDirectory: projectDirectory, force: true, homeDirectory });

        assert.strictEqual(
            fs.readFileSync(path.join(projectDirectory, 'CLAUDE.md'), 'utf8'),
            fs.readFileSync(path.join(AGENTS_SOURCE_DIR, 'CLAUDE.md'), 'utf8')
        );
        assert.strictEqual(fs.existsSync(staleSkillFile), false);
        assert.strictEqual(fs.existsSync(path.join(deployedSkillDirectory, 'SKILL.md')), true);
    });

    await t.test('refuses the home directory so it never deploys globally', (t) => {
        const { homeDirectory } = createProjectAndHome(t);

        assert.throws(
            () => deploy({ targetDirectory: homeDirectory, homeDirectory }),
            /home directory/
        );
        assert.deepStrictEqual(fs.readdirSync(homeDirectory), []);
    });

    await t.test('refuses a missing target, an empty path, and this repository', (t) => {
        const { projectDirectory, homeDirectory } = createProjectAndHome(t);

        assert.throws(
            () => deploy({ targetDirectory: path.join(projectDirectory, 'missing'), homeDirectory }),
            /does not exist/
        );
        assert.throws(() => deploy({ targetDirectory: '  ', homeDirectory }), /target project path is required/);
        assert.throws(() => deploy({ targetDirectory: REPOSITORY_ROOT, homeDirectory }), /this repository/);
    });
});

test('shared skills', async (t) => {
    await t.test('declare a frontmatter name that matches their directory name', () => {
        const skillNames = listSkillNames(SKILLS_SOURCE_DIR);
        assert.ok(skillNames.length > 0, 'expected at least one shared skill');

        for (const skillName of skillNames) {
            const skillText = fs.readFileSync(path.join(SKILLS_SOURCE_DIR, skillName, 'SKILL.md'), 'utf8');
            const nameMatch = skillText.match(/^---\n(?:.*\n)*?name:\s*(\S+)\s*\n(?:.*\n)*?---\n/);
            assert.ok(nameMatch, `${skillName}/SKILL.md must start with YAML frontmatter that has a name`);
            assert.strictEqual(nameMatch[1], skillName);
        }
    });
});

test('deploy CLI', async (t) => {
    await t.test('resolves a relative target against INIT_CWD and exits with 0', (t) => {
        const { projectDirectory } = createProjectAndHome(t);

        const result = spawnSync(process.execPath, [DEPLOY_BIN, path.basename(projectDirectory)], {
            env: { ...process.env, INIT_CWD: path.dirname(projectDirectory) },
            encoding: 'utf8'
        });

        assert.strictEqual(result.status, 0, result.stderr);
        assert.strictEqual(fs.existsSync(path.join(projectDirectory, 'CLAUDE.md')), true);
        assert.strictEqual(fs.existsSync(path.join(projectDirectory, 'AGENTS.md')), true);
    });

    await t.test('prints usage and exits with 1 when no target is given', () => {
        const result = spawnSync(process.execPath, [DEPLOY_BIN], { encoding: 'utf8' });

        assert.strictEqual(result.status, 1);
        assert.match(result.stderr, /Usage: npm run deploy/);
    });
});
