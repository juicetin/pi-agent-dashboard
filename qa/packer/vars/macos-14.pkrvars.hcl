# macOS 14 Sonoma x86_64
# Requires a manually-installed macOS VM (see README.md for setup steps)
# Packer provisions prereqs on top of the existing VM

source_vmx   = "REPLACE_WITH_PATH_TO_MACOS_VM.vmx"
vm_name      = "macos-14-x86"
ssh_username = "qa"
ssh_password = "qa"
cpus         = 4
memory       = 8192
