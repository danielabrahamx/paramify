FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    cmake \
    curl \
    wget \
    git \
    jq \
    sudo \
    zsh \
    vim \
    tmux \
    htop \
    net-tools \
    iputils-ping \
    dnsutils \
    && rm -rf /var/lib/apt/lists/*

# Set up non-root user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Install DFX
ENV DFX_VERSION=0.16.1
RUN sh -ci "$(curl -fsSL https://sdk.dfinity.org/install.sh)"
ENV PATH="/root/bin:${PATH}"

# Install Vessel (Motoko package manager)
RUN npm install -g vessel@0.7.0

# Install IC-specific tools
RUN cargo install ic-wasm --version 0.4.0
RUN cargo install candid-extractor
RUN cargo install pocket-ic

# Install Motoko tools
RUN npm install -g mo-fmt mo-doc

# Install additional development tools
RUN npm install -g \
    prettier \
    eslint \
    typescript \
    ts-node \
    nodemon \
    concurrently

# Set up workspace directory
WORKDIR /workspace

# Copy entrypoint scripts
COPY post-create.sh /workspace/.devcontainer/
COPY post-start.sh /workspace/.devcontainer/
RUN chmod +x /workspace/.devcontainer/*.sh

# Switch to non-root user
USER $USERNAME

# Set up shell
ENV SHELL=/bin/zsh
SHELL ["/bin/zsh", "-c"]