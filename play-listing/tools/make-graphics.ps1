# Vẽ biểu tượng app (512 + 1024) và ảnh bìa (1024x500) cho Google Play bằng System.Drawing.
# Chạy: powershell -File play-listing\tools\make-graphics.ps1   (từ thư mục gốc dự án)
Add-Type -AssemblyName System.Drawing
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$out  = Join-Path $root 'play-listing'
$shots = Join-Path $out 'anh-chup-man-hinh'

function New-RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); return $p
}

# Biểu tượng "tô phở": vẽ vào hình vuông $size px (nền tràn viền, Google tự bo góc)
function Draw-Icon([int]$size, [bool]$withBackground = $true, [double]$glyphScale = 1.0, [bool]$glyph = $true) {
  $bmp = New-Object Drawing.Bitmap($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'
  $s = $size / 1024.0
  $g.ScaleTransform([float]$s, [float]$s)
  if ($withBackground) {
    $bg = New-Object Drawing.Drawing2D.LinearGradientBrush((New-Object Drawing.Point(0,0)), (New-Object Drawing.Point(1024,1024)), [Drawing.Color]::FromArgb(255,243,134,72), [Drawing.Color]::FromArgb(255,196,64,20))
    $g.FillRectangle($bg, 0, 0, 1024, 1024)
  }
  if (-not $glyph) { $g.Dispose(); return $bmp }
  if ($glyphScale -ne 1.0) { $g.TranslateTransform(512, 512); $g.ScaleTransform([float]$glyphScale, [float]$glyphScale); $g.TranslateTransform(-512, -512) }
  $white = [Drawing.Brushes]::White
  # hơi nóng
  $steam = New-Object Drawing.Pen([Drawing.Color]::FromArgb(190,255,255,255), 22); $steam.StartCap='Round'; $steam.EndCap='Round'
  foreach ($x in 400, 512, 624) { $g.DrawBezier($steam, $x, 540, $x - 46, 470, $x + 46, 410, $x, 340) }
  # đũa
  $chop = New-Object Drawing.Pen([Drawing.Color]::FromArgb(255,255,232,208), 26); $chop.StartCap='Round'; $chop.EndCap='Round'
  $g.DrawLine($chop, 600, 585, 800, 285); $g.DrawLine($chop, 668, 600, 868, 322)
  # tô: nửa dưới hình tròn + viền miệng + chân
  $g.FillPie($white, 262, 372, 500, 500, 0, 180)
  $rim = New-RoundRect 226 566 572 54 27; $g.FillPath($white, $rim)
  $foot = New-RoundRect 420 846 184 46 23; $g.FillPath($white, $foot)
  # nước dùng (đường cong nhạt trên mặt tô)
  $soup = New-Object Drawing.Pen([Drawing.Color]::FromArgb(70,196,64,20), 14); $soup.StartCap='Round'; $soup.EndCap='Round'
  $g.DrawBezier($soup, 330, 700, 440, 740, 584, 740, 694, 700)
  $g.Dispose(); return $bmp
}

# 1) Biểu tượng
$icon1024 = Draw-Icon 1024
$icon1024.Save((Join-Path $out 'bieu-tuong-1024.png'), [Drawing.Imaging.ImageFormat]::Png)
$icon512 = New-Object Drawing.Bitmap(512, 512, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [Drawing.Graphics]::FromImage($icon512); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($icon1024, 0, 0, 512, 512); $g.Dispose()
$icon512.Save((Join-Path $out 'bieu-tuong-512.png'), [Drawing.Imaging.ImageFormat]::Png)

# 2) Ảnh bìa 1024x500 (không dùng kênh alpha)
$fg = New-Object Drawing.Bitmap(1024, 500, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [Drawing.Graphics]::FromImage($fg)
$g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
$bg = New-Object Drawing.Drawing2D.LinearGradientBrush((New-Object Drawing.Point(0,0)), (New-Object Drawing.Point(1024,500)), [Drawing.Color]::FromArgb(255,236,110,52), [Drawing.Color]::FromArgb(255,150,48,14))
$g.FillRectangle($bg, 0, 0, 1024, 500)
# họa tiết tròn mờ
$g.FillEllipse((New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(28,255,255,255))), 560, -160, 560, 560)
$g.FillEllipse((New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(20,255,255,255))), -140, 280, 420, 420)
# biểu tượng nhỏ
$small = Draw-Icon 120
$g.DrawImage($small, 56, 54, 84, 84)
# chữ
$fTitle = New-Object Drawing.Font('Segoe UI', 54, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$fSub   = New-Object Drawing.Font('Segoe UI', 30, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
$fSmall = New-Object Drawing.Font('Segoe UI', 25, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
$wh = [Drawing.Brushes]::White; $cream = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255,255,232,208))
$g.DrawString('Quản Lý Nhà Hàng', $fTitle, $wh, 56, 156)
$g.DrawString('Gọi món · Bếp · Thu ngân · VietQR', $fSub, $cream, 58, 236)
$lines = @('✓  Chạy cả khi mất mạng', '✓  Đồng bộ nhiều máy trong quán', '✓  Báo cáo doanh thu, quản lý kho')
$y = 310; foreach ($l in $lines) { $g.DrawString($l, $fSmall, $wh, 58, $y); $y += 40 }
# hai điện thoại bên phải (ảnh chụp thật của app)
function Draw-Phone($g, [string]$file, [float]$x, [float]$y, [float]$w) {
  $img = [Drawing.Image]::FromFile($file); $h = $w * 2.0
  $shadow = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(70,0,0,0))
  $g.FillPath($shadow, (New-RoundRect ($x + 8) ($y + 12) $w $h 26))
  $frame = New-RoundRect $x $y $w $h 26; $g.FillPath((New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255,28,24,22))), $frame)
  $b = 6; $inner = New-RoundRect ($x + $b) ($y + $b) ($w - 2*$b) ($h - 2*$b) 21
  $g.SetClip($inner); $g.DrawImage($img, $x + $b, $y + $b, $w - 2*$b, $h - 2*$b); $g.ResetClip(); $img.Dispose()
}
Draw-Phone $g (Join-Path $shots '05-thanh-toan-vietqr.png') 790 70 190
Draw-Phone $g (Join-Path $shots '01-phuc-vu-so-do-ban.png') 600 130 190
$g.Dispose()
$fg.Save((Join-Path $out 'anh-bia-1024x500.png'), [Drawing.Imaging.ImageFormat]::Png)
foreach ($f in 'bieu-tuong-512.png', 'bieu-tuong-1024.png', 'anh-bia-1024x500.png') {
  $i = [Drawing.Image]::FromFile((Join-Path $out $f)); "{0,-24} {1}x{2}  {3} KB" -f $f, $i.Width, $i.Height, [int]((Get-Item (Join-Path $out $f)).Length / 1KB); $i.Dispose()
}

# 3) Nguồn cho biểu tượng thích ứng của Android (@capacitor/assets đọc thư mục assets/ ở gốc dự án)
$assets = Join-Path $root 'assets'; New-Item -ItemType Directory -Force $assets | Out-Null
(Draw-Icon 1024).Save((Join-Path $assets 'icon-only.png'), [Drawing.Imaging.ImageFormat]::Png)                                   # biểu tượng đầy đủ
(Draw-Icon 1024 $false 0.74).Save((Join-Path $assets 'icon-foreground.png'), [Drawing.Imaging.ImageFormat]::Png)                  # chỉ hình tô phở, nền trong suốt, thu nhỏ vào vùng an toàn
(Draw-Icon 1024 $true 1.0 $false).Save((Join-Path $assets 'icon-background.png'), [Drawing.Imaging.ImageFormat]::Png)            # chỉ nền cam
foreach ($f in 'icon-only.png','icon-foreground.png','icon-background.png') { "{0,-24} assets\{0}" -f $f }