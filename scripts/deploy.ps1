param(
    [ValidateSet("up", "down", "restart", "status", "logs", "doctor", "config", "reset-db", "help")]
    [string] $Command = "up"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$MinimumPowerShell = [version]"7.6"
if ($PSVersionTable.PSVersion -lt $MinimumPowerShell) {
    throw "PowerShell $MinimumPowerShell or newer is required. Install it with: winget install --id Microsoft.PowerShell --source winget --installer-type wix"
}

$ScriptDir = Split-Path -Parent $PSCommandPath
$RootDir = Resolve-Path (Join-Path $ScriptDir "..")
$ComposeFile = Join-Path $RootDir "deploy/docker-compose.yml"
$EnvFile = if ($env:TOMODACHI_DEPLOY_ENV) { $env:TOMODACHI_DEPLOY_ENV } else { Join-Path $RootDir "deploy/.env" }
if (-not (Test-Path $EnvFile)) {
    $EnvFile = Join-Path $RootDir "deploy/.env.example"
}

function Show-Usage {
    @"
Usage: pwsh -File .\scripts\deploy.ps1 [up|down|restart|status|logs|doctor|config|reset-db]

Commands:
  up        Build and start Postgres, backend, and frontend. This is the default.
  down      Stop the stack without deleting the database volume.
  restart   Restart services without deleting the database volume.
  status    Show compose status; reports Docker daemon availability.
  logs      Tail stack logs.
  doctor    Check local prerequisites and selected env file.
  config    Render the effective Docker Compose config.
  reset-db  Stop the stack and delete the Postgres volume, then start fresh.
"@
}

function Get-EnvValue {
    param(
        [Parameter(Mandatory = $true)] [string] $Key,
        [Parameter(Mandatory = $true)] [string] $Fallback
    )
    if (Test-Path $EnvFile) {
        $match = Get-Content $EnvFile | Where-Object { $_ -match "^$([regex]::Escape($Key))=" } | Select-Object -Last 1
        if ($match) {
            return ($match -replace "^$([regex]::Escape($Key))=", "")
        }
    }
    return $Fallback
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Args)
    & docker compose --env-file $EnvFile -f $ComposeFile --project-directory $RootDir @Args
}

function Test-CommandExists {
    param([Parameter(Mandatory = $true)] [string] $Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

function Test-DockerDaemon {
    & docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Assert-DockerDaemon {
    Test-CommandExists "docker"
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose plugin is not available. Install Docker Desktop or Docker Engine with Compose."
    }
    if (-not (Test-DockerDaemon)) {
        throw "Docker daemon is not running. Start Docker Desktop, then retry."
    }
}

function Wait-HttpReady {
    param(
        [Parameter(Mandatory = $true)] [string] $Uri,
        [Parameter(Mandatory = $true)] [string] $Label,
        [int] $Attempts = 60,
        [int] $DelaySeconds = 2
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
                Write-Host "$Label is ready at $Uri"
                return
            }
        } catch {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "$Label did not become ready at $Uri"
}

function Invoke-Doctor {
    Write-Host "Tomodachi deploy doctor"
    Write-Host "repo: $RootDir"
    Write-Host "env: $EnvFile"
    Write-Host "powershell: $($PSVersionTable.PSVersion)"
    Test-CommandExists "git"
    Write-Host "git: $(& git --version)"
    Test-CommandExists "docker"
    Write-Host "docker: $(& docker --version)"
    Write-Host "compose: $(& docker compose version)"
    if (Test-DockerDaemon) {
        Write-Host "docker-daemon: running"
    } else {
        Write-Host "docker-daemon: not running (start Docker Desktop before 'up')"
    }
}

switch ($Command) {
    "up" {
        Assert-DockerDaemon
        Invoke-Compose up -d --build
        $backendPort = Get-EnvValue -Key "TOMODACHI_BACKEND_PORT" -Fallback "8080"
        $frontendPort = Get-EnvValue -Key "TOMODACHI_FRONTEND_PORT" -Fallback "5173"
        Wait-HttpReady -Uri "http://127.0.0.1:$backendPort/actuator/health" -Label "backend"
        Write-Host "frontend is available at http://127.0.0.1:$frontendPort"
    }
    "down" {
        Invoke-Compose down
    }
    "restart" {
        Assert-DockerDaemon
        Invoke-Compose restart
    }
    "status" {
        if (Test-DockerDaemon) {
            Invoke-Compose ps
        } else {
            Write-Host "Docker daemon is not running; no live Tomodachi status is available."
        }
    }
    "logs" {
        Assert-DockerDaemon
        Invoke-Compose logs -f --tail=200
    }
    "doctor" {
        Invoke-Doctor
    }
    "config" {
        Invoke-Compose config
    }
    "reset-db" {
        Assert-DockerDaemon
        Invoke-Compose down -v
        Invoke-Compose up -d --build
        $backendPort = Get-EnvValue -Key "TOMODACHI_BACKEND_PORT" -Fallback "8080"
        Wait-HttpReady -Uri "http://127.0.0.1:$backendPort/actuator/health" -Label "backend"
    }
    "help" {
        Show-Usage
    }
}
