$ErrorActionPreference = 'Continue'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Output ("admin=" + $isAdmin)

$vswhere = "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    Write-Output "vswhere-instances:"
    & $vswhere -all -property installationPath
    Write-Output "vswhere-display:"
    & $vswhere -all -property displayName
} else {
    Write-Output "vswhere-missing"
}

Write-Output ("literal-exists=" + (Test-Path "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Tools\MSVC"))
Write-Output ("vs2022-exists=" + (Test-Path "C:\Program Files\Microsoft Visual Studio\2022"))