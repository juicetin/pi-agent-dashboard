# Windows 11 Enterprise Evaluation x86_64
# Download from: https://www.microsoft.com/en-us/evalcenter/evaluate-windows-11-enterprise
# Evaluation period: 90 days (rebuild image to reset)

iso_url      = "REPLACE_WITH_WIN11_EVAL_ISO_PATH"
iso_checksum = "sha256:REPLACE_WITH_ACTUAL_CHECKSUM"

vm_name      = "windows-11-x86"
guest_os     = "windows9-64"
cpus         = 2
memory       = 4096
disk_size    = 65536
