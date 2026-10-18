param([string]$Repository = 'Matheus-Alves-Alexandre/game-tracker')
$ErrorActionPreference = 'Stop'
function Invoke-GhChecked {
  param([string[]]$Arguments)
  & gh @Arguments
  if ($LASTEXITCODE -ne 0) { throw "GitHub command failed: $($Arguments -join ' ')" }
}
$protection = @{
  required_status_checks = @{ strict = $true; contexts = @('Frontend','Backend','Application','Required checks') }
  enforce_admins = $true
  required_pull_request_reviews = @{ required_approving_review_count = 0; dismiss_stale_reviews = $true }
  restrictions = $null
  required_conversation_resolution = $true
  allow_force_pushes = $false
  allow_deletions = $false
} | ConvertTo-Json -Depth 8
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
try {
  [System.IO.File]::WriteAllText($temporary, $protection)
  Invoke-GhChecked -Arguments @('api',"repos/$Repository/branches/main/protection",'--method','PUT','--input',$temporary)
  Invoke-GhChecked -Arguments @('api',"repos/$Repository/actions/permissions/artifact-and-log-retention",'--method','PUT','-H','X-GitHub-Api-Version: 2026-03-10','-F','days=14')
  Invoke-GhChecked -Arguments @('api',"repos/$Repository",'--method','PATCH','-F','delete_branch_on_merge=true','-F','allow_squash_merge=true','-F','allow_merge_commit=false','-F','allow_rebase_merge=false')
  Invoke-GhChecked -Arguments @('api',"repos/$Repository/branches/main/protection",'--jq','{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, admins: .enforce_admins.enabled}')
  Invoke-GhChecked -Arguments @('api',"repos/$Repository/actions/permissions/artifact-and-log-retention",'-H','X-GitHub-Api-Version: 2026-03-10')
} finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary } }
