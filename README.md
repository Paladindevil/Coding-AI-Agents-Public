# Coding AI Agents (Public Starter)

Starter instruction files and a sample skill for Claude Code and GitHub Copilot, plus a small script that copies them into one of your projects.

## Directory Structure

```
agents/          Instruction files: CLAUDE.md (Claude Code) and AGENTS.md (GitHub Copilot)
skills/shared/   Skills shared by both agents, one folder per skill
bin/             CLI entrypoint used by `npm run deploy`
src/             Deploy implementation
tests/           Automated tests
```

## Quick Start

Use Node.js 22.3.0 or later. There are no dependencies to install.

1. **Clone** the repository.
2. **Deploy into a project:**

   ```bash
   npm run deploy -- /path/to/your-project
   ```

   Relative paths resolve against the directory you run the command from.

3. Open the project in Claude Code or GitHub Copilot and try the skill, for example `/explain-code src/index.js`.

## What gets deployed

| Source | Destination in your project | Read by |
|---|---|---|
| `agents/CLAUDE.md` | `CLAUDE.md` | Claude Code |
| `agents/AGENTS.md` | `AGENTS.md` | GitHub Copilot |
| `skills/shared/<name>/` | `.claude/skills/<name>/` | Claude Code and GitHub Copilot |

The deploy only writes into the project you name. It refuses your home directory, the filesystem root, and this repository.

If any destination already exists, the deploy stops and writes nothing. Re-run with `--force` to replace those files:

```bash
npm run deploy -- /path/to/your-project --force
```

`--force` replaces each deployed skill folder entirely, so remove any changes you want to keep from those folders first.

GitHub Copilot also reads `CLAUDE.md` when it is present, so keep the two instruction files consistent.

## Adding a skill

1. Create `skills/shared/<skill-name>/SKILL.md`.
2. Start the file with YAML frontmatter whose `name` matches the folder name, and a `description` saying what the skill does and when to use it:

   ```markdown
   ---
   name: skill-name
   description: What the skill does and when to use it.
   ---
   ```

3. Run `npm test`, then `npm run deploy` again.

## Tests

```bash
npm test
```

## Licence

Released under the [MIT Licence](LICENSE): anyone may use, copy, modify, and share it, provided the copyright notice is kept.
