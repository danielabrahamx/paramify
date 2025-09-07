{
  description = "Paramify ICP Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
        
        # Rust toolchain with WASM target
        rustToolchain = pkgs.rust-bin.stable.latest.default.override {
          extensions = [ "rust-src" "rustfmt" "clippy" ];
          targets = [ "wasm32-unknown-unknown" ];
        };

        # DFX SDK version
        dfxVersion = "0.16.1";
        
        # Custom DFX derivation
        dfx = pkgs.stdenv.mkDerivation rec {
          pname = "dfx";
          version = dfxVersion;
          
          src = pkgs.fetchurl {
            url = "https://github.com/dfinity/sdk/releases/download/${version}/dfx-${version}-x86_64-linux.tar.gz";
            sha256 = "sha256-PLACEHOLDER"; # Replace with actual hash
          };
          
          nativeBuildInputs = [ pkgs.autoPatchelfHook ];
          
          buildInputs = with pkgs; [
            stdenv.cc.cc.lib
            zlib
          ];
          
          sourceRoot = ".";
          
          installPhase = ''
            mkdir -p $out/bin
            cp dfx $out/bin/
            chmod +x $out/bin/dfx
          '';
        };

        # Development shell environment
        devShell = pkgs.mkShell {
          name = "paramify-icp-dev";
          
          buildInputs = with pkgs; [
            # Core tools
            git
            curl
            wget
            jq
            
            # Node.js and npm
            nodejs_20
            nodePackages.npm
            nodePackages.pnpm
            nodePackages.yarn
            
            # Rust toolchain
            rustToolchain
            cargo-edit
            cargo-watch
            cargo-expand
            wasm-pack
            wasm-bindgen-cli
            
            # IC-specific tools
            dfx
            
            # Motoko tools (if available in nixpkgs)
            # vessel
            # mo-fmt
            # mo-doc
            
            # Python for scripts
            python311
            python311Packages.pip
            
            # Development utilities
            tmux
            htop
            tree
            ripgrep
            fd
            bat
            exa
            
            # Editor support
            nodePackages.typescript
            nodePackages.typescript-language-server
            nodePackages.prettier
            nodePackages.eslint
            
            # Additional tools
            docker-compose
            protobuf
            openssl
            pkg-config
            libiconv
          ];
          
          shellHook = ''
            echo "🚀 Paramify ICP Development Environment"
            echo "======================================"
            echo ""
            echo "Environment:"
            echo "  Node.js: $(node --version)"
            echo "  npm:     $(npm --version)"
            echo "  Rust:    $(rustc --version)"
            echo "  DFX:     $(dfx --version 2>/dev/null || echo 'Not installed')"
            echo ""
            echo "Quick Start:"
            echo "  1. npm install       - Install dependencies"
            echo "  2. dfx start        - Start local replica"
            echo "  3. npm run deploy   - Deploy canisters"
            echo "  4. npm run dev      - Start development"
            echo ""
            
            # Set up environment variables
            export PATH=$PWD/node_modules/.bin:$PATH
            export RUST_BACKTRACE=1
            export DFX_VERSION="${dfxVersion}"
            
            # Create .env if it doesn't exist
            if [ ! -f .env ]; then
              echo "Creating .env from template..."
              cp .env.example .env 2>/dev/null || true
            fi
            
            # Install npm dependencies if needed
            if [ ! -d "node_modules" ]; then
              echo "Installing npm dependencies..."
              npm install
            fi
            
            # Install vessel if not present
            if ! command -v vessel &> /dev/null; then
              echo "Note: Vessel (Motoko package manager) not installed"
              echo "Install with: npm install -g vessel"
            fi
            
            # Install ic-wasm if not present
            if ! command -v ic-wasm &> /dev/null; then
              echo "Installing ic-wasm..."
              cargo install ic-wasm
            fi
            
            alias ll='exa -la'
            alias cat='bat'
            alias find='fd'
            alias grep='rg'
            
            echo "Ready for development! 🎉"
          '';
          
          # Environment variables
          DFX_VERSION = dfxVersion;
          NODE_ENV = "development";
          RUST_LOG = "info";
        };
      in
      {
        devShells.default = devShell;
        
        # Additional shells for specific tasks
        devShells = {
          inherit devShell;
          
          # Minimal shell for CI/CD
          ci = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_20
              rustToolchain
              dfx
              git
            ];
          };
          
          # Documentation shell
          docs = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_20
              python311
              mdbook
              nodePackages.npm
            ];
          };
        };
        
        # Nix packages that can be built
        packages = {
          inherit dfx;
          
          # Build the project
          paramify = pkgs.stdenv.mkDerivation {
            pname = "paramify-icp";
            version = "2.0.0";
            src = ./.;
            
            buildInputs = with pkgs; [
              nodejs_20
              rustToolchain
              dfx
            ];
            
            buildPhase = ''
              npm install
              npm run build
            '';
            
            installPhase = ''
              mkdir -p $out
              cp -r dist/* $out/
            '';
          };
        };
        
        # Development app
        apps.default = flake-utils.lib.mkApp {
          drv = self.packages.${system}.paramify;
        };
      }
    );
}