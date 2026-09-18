{
  # Toolchains mise cannot supply on NixOS: the user-profile gcc has no
  # linkable libc, and mise's dotnet download is a dynamically linked binary
  # that cannot start here. The C and C# modules resolve their compilers
  # through this dev shell once per run, then call the resolved paths directly.
  description = "skillquarium eval: C/C++ and .NET toolchains";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in {
      devShells = forAll (pkgs: {
        default = pkgs.mkShell { packages = [ pkgs.gcc pkgs.dotnet-sdk_10 ]; };
      });
    };
}
