# 保存豆瓣小号的登录信息（Cookie），给线报雷达用。
# Saves the spare Douban account's cookie for the collector. The file stays on this laptop
# (secrets/ is git-ignored) and is never uploaded to the website.
$dir = Join-Path $PSScriptRoot 'secrets'
New-Item -ItemType Directory -Force $dir | Out-Null
$file = Join-Path $dir 'douban-cookie.txt'

Write-Host ''
Write-Host '请粘贴豆瓣小号的 Cookie，然后按回车：' -ForegroundColor Cyan
Write-Host '(Paste the cookie and press Enter. Nothing is shown while you paste.)'
$secure = Read-Host -AsSecureString
$cookie = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$cookie = ($cookie -replace '^\s*cookie:\s*', '').Trim()

if ($cookie -notmatch 'dbcl2=') {
  Write-Host ''
  Write-Host '没找到登录信息（里面应该有 dbcl2=...）。请确认复制的是登录后的 Cookie，再运行一次。' -ForegroundColor Red
  Read-Host '按回车关闭'
  exit 1
}

Set-Content -Path $file -Value $cookie -NoNewline -Encoding ascii
Write-Host ''
Write-Host '已保存 ✅ 收集器下一轮（5 分钟内）会自动用小号读取豆瓣。' -ForegroundColor Green
Write-Host 'Saved. The collector picks it up within 5 minutes.'
Read-Host '按回车关闭'
