$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$mingw = Join-Path $env:LOCALAPPDATA 'Programs\MSYS2\mingw64\bin'
$requiredTools = @('gcc.exe', 'ar.exe', 'windres.exe')

foreach ($tool in $requiredTools) {
    $toolPath = Join-Path $mingw $tool
    if (-not (Test-Path $toolPath)) {
        throw "Missing $toolPath. Install MSYS2 MINGW64 tools: mingw-w64-x86_64-gcc and mingw-w64-x86_64-binutils."
    }
}

$environmentNames = @(
    'PATH',
    'RUSTUP_TOOLCHAIN',
    'CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER',
    'CC_x86_64_pc_windows_gnu',
    'AR_x86_64_pc_windows_gnu',
    'WINDRES'
)
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    $env:PATH = "$mingw;$env:PATH"
    $env:RUSTUP_TOOLCHAIN = 'stable-x86_64-pc-windows-gnu'
    $env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER = Join-Path $mingw 'gcc.exe'
    $env:CC_x86_64_pc_windows_gnu = Join-Path $mingw 'gcc.exe'
    $env:AR_x86_64_pc_windows_gnu = Join-Path $mingw 'ar.exe'
    $env:WINDRES = Join-Path $mingw 'windres.exe'

    Push-Location $repo
    try {
        rustup toolchain install stable-x86_64-pc-windows-gnu --profile minimal
        if ($LASTEXITCODE -ne 0) { throw 'Failed to install the Rust Windows GNU toolchain.' }

        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }

        npm.cmd run tauri -- build --target x86_64-pc-windows-gnu --no-bundle
        if ($LASTEXITCODE -ne 0) { throw 'The Tauri Windows GNU build failed.' }

        $artifact = Join-Path $repo 'src-tauri\target\x86_64-pc-windows-gnu\release\gct.exe'
        if (-not (Test-Path $artifact)) { throw "Build reported success but no executable exists at $artifact" }
        Write-Host "Built: $artifact"
    }
    finally {
        Pop-Location
    }
}
finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
}
