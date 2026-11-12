Set-Location -LiteralPath $PSScriptRoot -ErrorAction Stop

function Invoke-Step([scriptblock] $Step) {
  & $Step
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed with exit code ${LASTEXITCODE}: $Step"
  }
}

Copy-Item ".env.example" ".env"

Invoke-Step { npm install }
Invoke-Step { docker compose --profile dev up -d --build --wait }
Invoke-Step { docker compose --profile dev exec -T api-dev npm run migrate -- up }
