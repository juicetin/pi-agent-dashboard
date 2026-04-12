packer {
  required_plugins {
    vmware = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/vmware"
    }
  }
}

variable "source_vmx" {
  type        = string
  description = "Path to the manually-installed macOS ARM VM .vmx file"
}

variable "vm_name" {
  type    = string
  default = "macos-14-arm"
}

variable "ssh_username" {
  type    = string
  default = "qa"
}

variable "ssh_password" {
  type    = string
  default = "qa"
}

variable "cpus" {
  type    = number
  default = 4
}

variable "memory" {
  type    = number
  default = 8192
}

source "vmware-vmx" "macos-arm" {
  source_path  = var.source_vmx
  vm_name      = var.vm_name

  ssh_username = var.ssh_username
  ssh_password = var.ssh_password
  ssh_timeout  = "15m"
  ssh_handshake_attempts = 100

  shutdown_command = "sudo shutdown -h now"

  output_directory = "../output/${var.vm_name}"

  headless = true
}

build {
  sources = ["source.vmware-vmx.macos-arm"]

  provisioner "file" {
    sources     = ["scripts/provision-common.sh", "scripts/provision-macos.sh"]
    destination = "/tmp/"
  }

  provisioner "shell" {
    inline = [
      "chmod +x /tmp/provision-macos.sh /tmp/provision-common.sh",
      "cd /tmp && bash provision-macos.sh"
    ]
  }

  provisioner "shell" {
    inline = [
      "rm -f /tmp/provision-*.sh",
      "history -c"
    ]
  }
}
