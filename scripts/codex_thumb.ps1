# Make the note header image (thumb.jpg 1280x670) for one diary post with Codex's built-in image generation
# (runs the local Codex CLI bundled with the VS Code extension; uses Toyo's ChatGPT plan, no API key, no per-image cost),
# then push it and put the URL into the open "note起票" Issue so Claude in Chrome sets it as the header image.
#
#   .\scripts\codex_thumb.ps1 -Day 57 -Headline "..." -Subtitle "..." -Truth "..." -Scene "..."
#   .\scripts\codex_thumb.ps1 -Day 57 ... -DryRun            # only print the prompt
#   .\scripts\codex_thumb.ps1 -Day 57 -FromPng C:\x\day57.png   # skip Codex, just convert + push + Issue
#   .\scripts\codex_thumb.ps1 -Day 57 ... -NoPush             # generate + convert, leave git/Issue alone
#
# Headline/Subtitle are the exact Japanese strings rendered in the image. Truth/Scene/Avoid are English (see
# note-thumbnails\day56-prompt.txt for the reference). Generation takes 5-35 minutes; run it in the background.
param(
  [Parameter(Mandatory = $true)][int]$Day,
  [string]$Headline = "",
  [string]$Subtitle = "",
  [string]$Truth = "",
  [string]$Scene = "",
  [string]$Avoid = "",
  [string]$FromPng = "",
  [switch]$DryRun,
  [switch]$NoPush,
  [int]$TimeoutMin = 45,
  [string]$SiteRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$WorkRoot = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'note-thumbnails')
)
$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)

$slug = if ($Day -le 20) { "sahchonikki_day$Day" } else { "shachonikki_day$Day" }
$articleDir = Join-Path $SiteRoot $slug
if (-not (Test-Path -LiteralPath $articleDir)) { throw "Article folder not found: $articleDir" }
$html = [System.IO.File]::ReadAllText((Join-Path $articleDir 'index.html'), [System.Text.Encoding]::UTF8)
$h1 = [regex]::Match($html, '<h1>(.*?)</h1>').Groups[1].Value.Trim()
$title = ($h1 -replace '^vol\d+\s*', '') -replace '&amp;', '&' -replace '&quot;', '"'
$outJpg = Join-Path $articleDir 'thumb.jpg'
New-Item -ItemType Directory -Force $WorkRoot | Out-Null
$png = Join-Path $WorkRoot ("day{0}.png" -f $Day)

function Find-Codex {
  $cmd = Get-Command codex -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $ext = Get-ChildItem "$HOME\.vscode\extensions" -Directory -Filter 'openai.chatgpt-*' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($ext) {
    $exe = Join-Path $ext.FullName 'bin\windows-x86_64\codex.exe'
    if (Test-Path -LiteralPath $exe) { return $exe }
  }
  throw "codex.exe not found (VS Code extension openai.chatgpt or codex on PATH)"
}

# ---- 1. generate with Codex (unless -FromPng) ----
if ($FromPng -ne "") {
  if (-not (Test-Path -LiteralPath $FromPng)) { throw "PNG not found: $FromPng" }
  Copy-Item -LiteralPath $FromPng -Destination $png -Force
  Write-Host "Using existing PNG: $FromPng"
} else {
  foreach ($k in 'Headline', 'Subtitle', 'Truth', 'Scene') {
    if ((Get-Variable $k).Value -eq "") { throw "-$k is required (or use -FromPng)" }
  }
  $template = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'codex_thumb_prompt.txt'), [System.Text.Encoding]::UTF8)
  $avoidText = if ($Avoid -ne "") { ", " + $Avoid.Trim().TrimEnd('.') } else { "" }
  $promptOut = Join-Path $WorkRoot ("day{0}-prompt.txt" -f $Day)
  $prompt = $template.Replace('{DAY}', "$Day").Replace('{TITLE}', $title).Replace('{HEADLINE}', $Headline).Replace('{SUBTITLE}', $Subtitle).Replace('{TRUTH}', $Truth.Trim()).Replace('{SCENE}', $Scene.Trim()).Replace('{AVOID}', $avoidText).Replace('{OUT_PNG}', $png).Replace('{OUT_PROMPT}', $promptOut)
  [System.IO.File]::WriteAllText((Join-Path $WorkRoot ("day{0}-request.txt" -f $Day)), $prompt, $utf8)
  if ($DryRun) { Write-Host $prompt; return }

  $codex = Find-Codex
  $work = Join-Path $WorkRoot ("_codex\day{0}" -f $Day)
  New-Item -ItemType Directory -Force $work | Out-Null
  if (Test-Path -LiteralPath $png) { Remove-Item -LiteralPath $png -Force }
  $last = Join-Path $work 'last.txt'
  Write-Host ("Codex exec start {0:HH:mm} ({1})" -f (Get-Date), $codex)
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $proc = Start-Process -FilePath $codex -ArgumentList @('exec', '-C', "`"$work`"", '--add-dir', "`"$WorkRoot`"", '-s', 'workspace-write', '--skip-git-repo-check', '--ephemeral', '--color', 'never', '-o', "`"$last`"", '-') `
    -RedirectStandardInput (Join-Path $WorkRoot ("day{0}-request.txt" -f $Day)) -RedirectStandardOutput (Join-Path $work 'stdout.txt') -RedirectStandardError (Join-Path $work 'stderr.txt') -NoNewWindow -PassThru
  if (-not $proc.WaitForExit($TimeoutMin * 60 * 1000)) { $proc.Kill(); throw "Codex timed out after $TimeoutMin min" }
  Write-Host ("Codex exec done in {0}s (exit {1})" -f [int]$sw.Elapsed.TotalSeconds, $proc.ExitCode)
  if (-not (Test-Path -LiteralPath $png)) {
    # fall back: newest PNG Codex generated during this run
    $cand = Get-ChildItem "$HOME\.codex\generated_images" -Recurse -File -Filter '*.png' -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -gt (Get-Date).AddSeconds(-$sw.Elapsed.TotalSeconds - 60) } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($cand) { Copy-Item -LiteralPath $cand.FullName -Destination $png -Force; Write-Host "Copied from generated_images: $($cand.Name)" }
    else { throw "Codex finished but no PNG at $png (see $work\stdout.txt / stderr.txt)" }
  }
}

# ---- 2. convert to 1280x670 JPEG (cover crop, quality 85) ----
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($png)
$W = 1280; $H = 670
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = 'HighQuality'; $g.PixelOffsetMode = 'HighQuality'
$g.Clear([System.Drawing.Color]::White)
$scale = [Math]::Max($W / $src.Width, $H / $src.Height)
$dw = [int][Math]::Round($src.Width * $scale); $dh = [int][Math]::Round($src.Height * $scale)
$g.DrawImage($src, [int](($W - $dw) / 2), [int](($H - $dh) / 2), $dw, $dh)
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 85L
$bmp.Save($outJpg, $codec, $ep)
$srcW = $src.Width; $srcH = $src.Height
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
Write-Host ("thumb.jpg: {0} ({1} bytes, from {2}x{3})" -f $outJpg, (Get-Item -LiteralPath $outJpg).Length, $srcW, $srcH)
if ($NoPush) { return }

# ---- 3. push ----
Push-Location $SiteRoot
try {
  git add -- "$slug/thumb.jpg"
  git commit -q -m ("vol{0}: note 見出し画像 thumb.jpg（Codex 生成）" -f $Day)
  git push -q origin main
  Write-Host "pushed thumb.jpg"
} finally { Pop-Location }

# ---- 4. put the URL into the open note Issue ----
$url = "https://www.toyoseeds.com/$slug/thumb.jpg"
$repo = 'hiroyatoyoshima-lgtm/toyoseeds-hp'
$issues = gh issue list -R $repo --label note --state open --limit 50 --json number,title | ConvertFrom-Json
$issue = $issues | Where-Object { $_.title -match ("^note起票: vol{0} " -f $Day) } | Select-Object -First 1
if (-not $issue) { Write-Host "no open note Issue for vol$Day (nothing to edit)"; return }
$body = (gh issue view $issue.number -R $repo --json body -q .body) -join "`n"
$newBody = [regex]::Replace($body, '(?m)^- 見出し画像: .*$', ("- 見出し画像: {0}（この URL の画像を見出し画像に設定）" -f $url))
if ($newBody -eq $body) { Write-Host "Issue #$($issue.number): header-image line not found; left as is"; return }
$tmp = Join-Path $WorkRoot ("day{0}-issue-body.md" -f $Day)
[System.IO.File]::WriteAllText($tmp, $newBody, $utf8)
gh issue edit $issue.number -R $repo --body-file $tmp | Out-Null
Remove-Item -LiteralPath $tmp -Force
Write-Host "Issue #$($issue.number): header image set to $url"
