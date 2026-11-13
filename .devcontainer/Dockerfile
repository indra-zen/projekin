# Projekin development image
# Base: Microsoft Dev Containers TypeScript/Node image (Debian bookworm).
# Ships Node.js, npm, TypeScript, git, zsh/bash, sudo and a non-root `node` user (UID 1000).
ARG NODE_VERSION=24
FROM mcr.microsoft.com/devcontainers/typescript-node:${NODE_VERSION}-bookworm

# Common development utilities (git is already included in the base image).
RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        ripgrep \
        fd-find \
        jq \
        less \
        procps \
        lsof \
        net-tools \
        iputils-ping \
        unzip \
        zip \
        vim \
        nano \
    && ln -sf /usr/bin/fdfind /usr/local/bin/fd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Directories that get backed by named volumes (see devcontainer.json "mounts").
# They are created here with `node` ownership so freshly created volumes inherit it.
RUN mkdir -p /home/node/.claude /commandhistory \
    && touch /commandhistory/.bash_history \
    && chown -R node:node /home/node/.claude /commandhistory \
    && echo 'export PROMPT_COMMAND="history -a" HISTFILE=/commandhistory/.bash_history' >> /home/node/.bashrc

USER node

# Claude Code CLI, installed into the image's user-writable npm global prefix.
# Authentication is NOT baked in: run `claude` inside the container and log in interactively.
ARG CLAUDE_CODE_VERSION=latest
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
    && npm cache clean --force
