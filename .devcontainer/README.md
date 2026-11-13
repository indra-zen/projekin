# Projekin dev container

A reproducible development environment for Projekin (Next.js App Router, TypeScript, npm).

## What's inside

| Item | Details |
|---|---|
| Base image | `mcr.microsoft.com/devcontainers/typescript-node:24-bookworm` |
| Node.js | 24 (LTS), with npm and TypeScript (`tsc`) |
| Git tooling | git (dev container feature), GitHub CLI `gh` |
| Utilities | ripgrep, fd, jq, less, procps, lsof, net-tools, ping, zip/unzip, vim, nano |
| Claude Code | `claude` CLI, installed globally with npm |
| User | non-root `node`, with UID matched to your host user |
| Ports | 3000 (Next.js dev server), forwarded automatically |

VS Code extensions installed in the container: ESLint, Prettier, Tailwind CSS IntelliSense,
Docker, Pretty TypeScript Errors, GitHub Copilot and Copilot Chat, and Claude Code.
TypeScript support is built into VS Code. Once `typescript` is installed in the project,
VS Code uses the project's version.

## Files

- `devcontainer.json`: container definition, features, mounts, ports, and VS Code settings and extensions.
- `Dockerfile`: base image, extra utilities, and the Claude Code CLI.
- `post-create.sh`: runs once after the container is created. If a lockfile exists it runs `npm ci`, otherwise `npm install` (and it skips this when there is no `package.json` yet).
- `../.vscode/extensions.json`: recommends the Dev Containers extension on the host.

## Prerequisites (host)

1. Docker Engine or Docker Desktop, running. (Podman also works. See the notes below.)
2. VS Code with the **Dev Containers** extension (`ms-vscode-remote.remote-containers`).

## Build and open the project in the container

1. Open the `projekin` folder in VS Code.
2. When VS Code shows "Folder contains a Dev Container configuration file", click **Reopen in Container**.
   If you miss the prompt: press `F1` and run **Dev Containers: Reopen in Container**.
3. The first build takes a few minutes. Later opens reuse the cached image.

The VS Code window is now connected to the container. Integrated terminals (`` Ctrl+` ``),
tasks, debugging, extensions, GitHub Copilot and Claude Code all run inside the container
against `/workspaces/projekin`.

Other commands (`F1`):

- **Dev Containers: Rebuild Container**: run after changing `Dockerfile` or `devcontainer.json`.
- **Dev Containers: Rebuild Without Cache**: forces a clean rebuild. It also pulls the latest Claude Code.
- **Dev Containers: Reopen Folder Locally**: go back to the host.

From the command line (optional, needs `npm i -g @devcontainers/cli`):

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

## Running the app

Once the Next.js app exists:

```bash
npm run dev
```

Then open http://localhost:3000 on the host. The port is forwarded automatically.

## Claude Code

Run `claude` in a container terminal and log in when prompted. Login state is stored in a
Docker volume (`projekin-claude-config-<id>`) mounted at `/home/node/.claude`, so it survives
rebuilds. It is never written to the repository. No API keys or secrets are part of this
configuration. If you use an API key, export it in your own terminal session rather than
adding it to `devcontainer.json`.

## GitHub Copilot

Copilot and Copilot Chat are installed in the container and use the GitHub account you are
signed in with in VS Code. They see the container's workspace and terminal.

## Notes

- **SELinux (Fedora/RHEL):** `runArgs` includes `--security-opt label=disable` so the container
  can read the bind-mounted workspace. This applies only to this container.
- **Podman:** set `"dev.containers.dockerPath": "podman"` in your VS Code user settings. For
  rootless Podman, you may also need `"--userns=keep-id"` in `runArgs` so files keep your UID.
- **File watching on macOS/Windows:** if hot reload misses changes, add
  `"WATCHPACK_POLLING": "true"` to `containerEnv`. Linux hosts do not need this.
- **Pinning Claude Code:** change the `CLAUDE_CODE_VERSION` build arg from `latest` to a version.
