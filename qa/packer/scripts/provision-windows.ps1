# Windows provisioning: nvm-windows, Node.js LTS, Git, VS Build Tools
$ErrorActionPreference = "Stop"

Write-Host "=== Installing Chocolatey ==="
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}
Write-Host "Chocolatey: $(choco --version)"

Write-Host "=== Installing Git ==="
choco install git -y --no-progress
# Refresh PATH after git install
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Write-Host "Git: $(git --version)"

Write-Host "=== Installing nvm-windows ==="
choco install nvm -y --no-progress
# Refresh PATH after nvm install
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Host "=== Installing Node.js LTS ==="
nvm install lts
nvm use lts
# Refresh PATH after node install
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Write-Host "Node: $(node --version)"
Write-Host "npm: $(npm --version)"

Write-Host "=== Installing Visual Studio Build Tools ==="
# Install VS Build Tools with C++ workload for native module compilation (node-pty)
choco install visualstudio2022buildtools -y --no-progress --package-parameters `
    "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --quiet --wait"

Write-Host "=== Enabling OpenSSH Server ==="
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Set-Service -Name sshd -StartupType Automatic
Start-Service sshd
# Set default shell to PowerShell for SSH
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
    -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -PropertyType String -Force

Write-Host "=== Windows provisioning complete ==="
