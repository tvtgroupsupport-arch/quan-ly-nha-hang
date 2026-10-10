# Chạy kịch bản kiểm tra gói cước trên Supabase TRUNG TÂM đã liên kết (supabase link). An toàn: mọi thứ nằm trong một giao dịch và bị ROLLBACK.
# Cách dùng (từ thư mục gốc dự án):  powershell -File supabase\tests\play-scenarios.ps1
# Mặc định kiểm tra bản hàm record_play_purchase TRONG supabase/central-setup.sql (kể cả khi chưa áp dụng lên database).
param([string]$Supabase = 'C:\Users\user\tools\supabase\supabase.exe')
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$setup = [IO.File]::ReadAllText((Join-Path $root 'supabase\central-setup.sql'), [Text.Encoding]::UTF8)
$i = $setup.IndexOf('create or replace function public.record_play_purchase(')
$j = $setup.IndexOf('end $$;', $i) + 7
$fn = $setup.Substring($i, $j - $i)
$sql = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'play-scenarios.sql'), [Text.Encoding]::UTF8).Replace('@@FUNCTION@@', $fn)
$tmp = Join-Path $env:TEMP 'play-scenarios-run.sql'
[IO.File]::WriteAllText($tmp, $sql, (New-Object Text.UTF8Encoding $false))
$o = & $Supabase db query --linked -f $tmp 2>&1 | Out-String
[IO.File]::Delete($tmp)
$rows = [regex]::Matches($o, '\{[^{}]*"scenario"[^{}]*\}') | ForEach-Object { $_.Value | ConvertFrom-Json } | Sort-Object n
if (-not $rows) { 'KHONG DOC DUOC KET QUA:'; $o; exit 2 }
foreach ($r in $rows) { '{0,2}. [{1}] {2}   ({3})' -f $r.n, $(if ($r.ok) { 'ĐẠT' } else { 'LỖI' }), $r.scenario, $r.info }
$bad = @($rows | Where-Object { -not $_.ok }).Count
"--- $($rows.Count - $bad)/$($rows.Count) đạt"
if ($bad) { exit 1 }
