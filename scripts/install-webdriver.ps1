$ErrorActionPreference = 'Stop'
$appDirectory = 'C:\Program Files (x86)\Microsoft\EdgeWebView\Application'
$version = Get-ChildItem -LiteralPath $appDirectory -Directory | Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1 -ExpandProperty Name
if (-not $version) { throw 'Microsoft WebView2 runtime was not found. Install it before running desktop tests.' }
$target = Join-Path $PSScriptRoot '..\.tools\webdriver'
New-Item -ItemType Directory -Path $target -Force | Out-Null
$archive = Join-Path $target 'edgedriver.zip'
Invoke-WebRequest -Uri "https://msedgedriver.microsoft.com/$version/edgedriver_win64.zip" -OutFile $archive
Expand-Archive -LiteralPath $archive -DestinationPath $target -Force
& (Join-Path $target 'msedgedriver.exe') --version
