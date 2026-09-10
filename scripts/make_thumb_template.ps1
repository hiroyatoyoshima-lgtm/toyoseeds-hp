# Render the note header image (thumb.jpg, 1280x670) for ONE diary post from the template
# (same drawing as generate_diary_thumbnails.ps1, no AI / no API cost).
#
#   .\scripts\make_thumb_template.ps1 -Day 57                                  # copy comes from note-thumbnails\thumbnail-copy.json
#   .\scripts\make_thumb_template.ps1 -Day 57 -Category habits -Hook "line1`nline2"   # upsert the copy into the json, then render
#   .\scripts\make_thumb_template.ps1 -Day 56 -OutFile C:\tmp\day56.jpg      # render somewhere else (test)
#
# Inputs (outside the git repo, on Toyo's machine): <repo parent>\note-thumbnails\thumbnail-copy.json
# and the background images in <repo parent>\note-thumbnails\_source.
# Output: <site>\shachonikki_dayNN\thumb.jpg (push it together with the article; the note-kihyo Action then puts the URL in the Issue).
param(
  [Parameter(Mandatory = $true)][int]$Day,
  [string]$Category = "",
  [string]$Hook = "",
  [string]$OutFile = "",
  [string]$SiteRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$CopyRoot = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'note-thumbnails')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$canvasWidth = 1280
$canvasHeight = 670
$sourceRoot = Join-Path $CopyRoot '_source'
$copyPath = Join-Path $CopyRoot 'thumbnail-copy.json'
$backgroundPaths = @{
  growth   = Join-Path $sourceRoot 'diary-thumbnail-bg.png'
  action   = Join-Path $sourceRoot 'background-action.png'
  people   = Join-Path $sourceRoot 'background-people.png'
  business = Join-Path $sourceRoot 'background-business.png'
  habits   = Join-Path $sourceRoot 'background-habits.png'
}
$accentColors = @{
  growth   = [System.Drawing.Color]::FromArgb(82, 196, 104)
  action   = [System.Drawing.Color]::FromArgb(236, 142, 62)
  people   = [System.Drawing.Color]::FromArgb(70, 190, 171)
  business = [System.Drawing.Color]::FromArgb(206, 194, 91)
  habits   = [System.Drawing.Color]::FromArgb(93, 174, 225)
}

if (-not (Test-Path -LiteralPath $copyPath)) { throw "Thumbnail copy data not found: $copyPath" }

# --- copy: upsert into json when -Hook is given, otherwise read the json ---
$utf8 = [System.Text.UTF8Encoding]::new($false)
# PS 5.1: ConvertFrom-Json emits the whole array as one object; assign first, then wrap (avoids a nested array)
$parsed = [System.IO.File]::ReadAllText($copyPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$copyData = @($parsed)
if ($Hook -ne "") {
  if ($Category -eq "") { throw "-Category is required together with -Hook (growth|action|people|business|habits)" }
  $Hook = $Hook -replace '\\n', "`n"
  $existing = $copyData | Where-Object { $_.day -eq $Day } | Select-Object -First 1
  if ($existing) {
    $existing.category = $Category
    $existing.hook = $Hook
  } else {
    $copyData += [pscustomobject]@{ day = $Day; category = $Category; hook = $Hook }
    $copyData = @($copyData | Sort-Object day)
  }
  # keep the file's compact one-entry-per-line style (ConvertTo-Json would reflow it and escape Japanese)
  $esc = { param($s) ($s -replace '\\', '\\\\' -replace '"', '\"' -replace "`r", '' -replace "`n", '\n') }
  $lines = foreach ($c in $copyData) { '  { "day": ' + [int]$c.day + ', "category": "' + $c.category + '", "hook": "' + (& $esc ([string]$c.hook)) + '" }' }
  $json = "[`n" + ($lines -join ",`n") + "`n]`n"
  [System.IO.File]::WriteAllText($copyPath, $json, $utf8)
  Write-Host ("Copy saved for DAY {0:D2} ({1})" -f $Day, $Category)
}
$copy = $copyData | Where-Object { $_.day -eq $Day } | Select-Object -First 1
if (-not $copy) { throw "No copy for day $Day in $copyPath (pass -Category and -Hook)" }
$title = [string]$copy.hook
$category = [string]$copy.category
if (-not $backgroundPaths.ContainsKey($category)) { throw "Unknown category '$category' (growth|action|people|business|habits)" }
if (-not (Test-Path -LiteralPath $backgroundPaths[$category])) { throw "Background image not found: $($backgroundPaths[$category])" }

# --- output path ---
if ($OutFile -eq "") {
  $dirName = if ($Day -le 20) { "sahchonikki_day$Day" } else { "shachonikki_day$Day" }
  $articleDir = Join-Path $SiteRoot $dirName
  if (-not (Test-Path -LiteralPath $articleDir)) { throw "Article folder not found: $articleDir" }
  $OutFile = Join-Path $articleDir 'thumb.jpg'
}

function New-RoundedRectanglePath {
  param([System.Drawing.RectangleF]$Rectangle, [float]$Radius)
  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Get-FittedTitleFont {
  param([System.Drawing.Graphics]$Graphics, [string]$Text, [float]$MaxWidth, [float]$MaxHeight)
  foreach ($size in 144, 136, 128, 120, 112, 104, 96, 88, 80) {
    $font = [System.Drawing.Font]::new('Yu Gothic UI', $size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = [System.Drawing.StringFormat]::new()
    $format.Trimming = [System.Drawing.StringTrimming]::Word
    $measured = $Graphics.MeasureString($Text, $font, [System.Drawing.SizeF]::new($MaxWidth, 1000), $format)
    $format.Dispose()
    if ($measured.Height -le $MaxHeight) { return $font }
    $font.Dispose()
  }
  return [System.Drawing.Font]::new('Yu Gothic UI', 80, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-CoverImage {
  param([System.Drawing.Graphics]$Graphics, [System.Drawing.Image]$Image, [int]$Width, [int]$Height)
  $scale = [Math]::Max($Width / $Image.Width, $Height / $Image.Height)
  $drawWidth = [int][Math]::Ceiling($Image.Width * $scale)
  $drawHeight = [int][Math]::Ceiling($Image.Height * $scale)
  $x = [int](($Width - $drawWidth) / 2)
  $y = [int](($Height - $drawHeight) / 2)
  $Graphics.DrawImage($Image, $x, $y, $drawWidth, $drawHeight)
}

$background = [System.Drawing.Image]::FromFile($backgroundPaths[$category])
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$encoderParameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]88)

$bitmap = [System.Drawing.Bitmap]::new($canvasWidth, $canvasHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

Draw-CoverImage -Graphics $graphics -Image $background -Width $canvasWidth -Height $canvasHeight

$leftShade = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Point]::new(0, 0), [System.Drawing.Point]::new(860, 0),
  [System.Drawing.Color]::FromArgb(86, 8, 27, 52), [System.Drawing.Color]::FromArgb(0, 8, 27, 52))
$graphics.FillRectangle($leftShade, 0, 0, 900, $canvasHeight)

$accent = $accentColors[$category]
$eyebrowFont = [System.Drawing.Font]::new('Segoe UI', 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$dayFont = [System.Drawing.Font]::new('Segoe UI', 42, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$footerFont = [System.Drawing.Font]::new('Segoe UI', 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, 231, 239))
$accentBrush = [System.Drawing.SolidBrush]::new($accent)

$graphics.DrawString('PRESIDENT''S DIARY', $eyebrowFont, $mutedBrush, 72, 60)
$graphics.FillRectangle($accentBrush, 72, 96, 66, 6)

$pillRect = [System.Drawing.RectangleF]::new(72, 122, 218, 76)
$pillPath = New-RoundedRectanglePath -Rectangle $pillRect -Radius 16
$graphics.FillPath($accentBrush, $pillPath)
$dayLabel = 'DAY {0:D2}' -f $Day
$daySize = $graphics.MeasureString($dayLabel, $dayFont)
$graphics.DrawString($dayLabel, $dayFont, $whiteBrush, 72 + ((218 - $daySize.Width) / 2), 132)

$titleFont = Get-FittedTitleFont -Graphics $graphics -Text $title -MaxWidth 820 -MaxHeight 360
$titleFormat = [System.Drawing.StringFormat]::new()
$titleFormat.Trimming = [System.Drawing.StringTrimming]::Word
$titleFormat.LineAlignment = [System.Drawing.StringAlignment]::Near
$titleRect = [System.Drawing.RectangleF]::new(72, 214, 820, 360)
$graphics.DrawString($title, $titleFont, $whiteBrush, $titleRect, $titleFormat)

$graphics.FillRectangle($accentBrush, 72, 610, 40, 5)
$graphics.DrawString('Toyo', $footerFont, $whiteBrush, 72, 622)
$toyoWidth = $graphics.MeasureString('Toyo', $footerFont).Width
$graphics.DrawString('Seeds', $footerFont, $accentBrush, 72 + $toyoWidth - 4, 622)

$bitmap.Save($OutFile, $jpegCodec, $encoderParameters)

$graphics.Dispose(); $bitmap.Dispose(); $leftShade.Dispose(); $background.Dispose()
$eyebrowFont.Dispose(); $dayFont.Dispose(); $footerFont.Dispose(); $titleFont.Dispose(); $titleFormat.Dispose()
$whiteBrush.Dispose(); $mutedBrush.Dispose(); $accentBrush.Dispose(); $pillPath.Dispose(); $encoderParameters.Dispose()

Write-Host ("Created DAY {0:D2} -> {1} ({2} bytes)" -f $Day, $OutFile, (Get-Item -LiteralPath $OutFile).Length)
