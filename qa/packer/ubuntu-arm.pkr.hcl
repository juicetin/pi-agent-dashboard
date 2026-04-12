packer {
  required_plugins {
    vmware = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/vmware"
    }
  }
}

variable "iso_url" {
  type = string
}

variable "iso_checksum" {
  type = string
}

variable "vm_name" {
  type    = string
  default = "ubuntu-24-arm"
}

variable "guest_os" {
  type    = string
  default = "arm-ubuntu-64"
}

variable "cpus" {
  type    = number
  default = 2
}

variable "memory" {
  type    = number
  default = 4096
}

variable "disk_size" {
  type    = number
  default = 40960
}

variable "ssh_username" {
  type    = string
  default = "qa"
}

variable "ssh_password" {
  type    = string
  default = "qa"
}

variable "ssh_timeout" {
  type    = string
  default = "30m"
}

source "vmware-iso" "ubuntu-arm" {
  iso_url      = var.iso_url
  iso_checksum = var.iso_checksum

  vm_name          = var.vm_name
  guest_os_type    = var.guest_os
  cpus             = var.cpus
  memory           = var.memory
  disk_size        = var.disk_size
  disk_type_id     = "0"
  network          = "nat"

  ssh_username     = var.ssh_username
  ssh_password     = var.ssh_password
  ssh_timeout      = var.ssh_timeout
  ssh_handshake_attempts = 100

  shutdown_command = "sudo shutdown -P now"

  output_directory = "../output/${var.vm_name}"

  http_directory = "http"

  boot_wait = "5s"
  boot_command = [
    "<esc><wait>",
    "e<wait>",
    "<down><down><down><end>",
    " autoinstall ds=nocloud-net;s=http://{{ .HTTPIP }}:{{ .HTTPPort }}/",
    "<f10>"
  ]
}

build {
  sources = ["source.vmware-iso.ubuntu-arm"]

  provisioner "file" {
    sources     = ["scripts/provision-common.sh", "scripts/provision-linux.sh"]
    destination = "/tmp/"
  }

  provisioner "shell" {
    inline = [
      "chmod +x /tmp/provision-linux.sh /tmp/provision-common.sh",
      "cd /tmp && bash provision-linux.sh"
    ]
  }

  provisioner "shell" {
    inline = [
      "rm -f /tmp/provision-*.sh",
      "sudo truncate -s 0 /var/log/*.log",
      "history -c"
    ]
  }
}
