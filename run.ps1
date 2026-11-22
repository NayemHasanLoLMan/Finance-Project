$ErrorActionPreference = 'Stop'
$candidates = @(
    (Join-Path $PSScriptRoot '.venv\Scripts\python.exe'),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe')
)
$installed = Get-Command python -ErrorAction SilentlyContinue
if ($installed -and $installed.Source -notlike '*WindowsApps*') {
    $candidates = @($candidates[0], $installed.Source, $candidates[1])
}
$pythonExecutable = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $pythonExecutable) { throw 'Install Python and requirements.txt, then run python main.py --once.' }

# The monitoring dashboard is the default entry point. Use "pipeline" for CLI mode.
$usePipeline = $args.Count -gt 0 -and ($args[0] -eq 'pipeline' -or $args[0] -eq 'once' -or $args[0] -eq '--once')
if ($usePipeline) {
    if ($args[0] -eq 'once') {
        $remainingArgs = @('--once') + @($args | Select-Object -Skip 1)
    } elseif ($args[0] -eq 'pipeline') {
        $remainingArgs = $args | Select-Object -Skip 1
    } else {
        $remainingArgs = $args
    }
    & $pythonExecutable -B (Join-Path $PSScriptRoot 'main.py') @remainingArgs
} else {
    if ($args.Count -gt 0 -and ($args[0] -eq 'app' -or $args[0] -eq 'web' -or $args[0] -eq 'server')) {
        $remainingArgs = $args | Select-Object -Skip 1
    } else {
        $remainingArgs = $args
    }
    & $pythonExecutable -B (Join-Path $PSScriptRoot 'app.py') @remainingArgs
}
exit $LASTEXITCODE
