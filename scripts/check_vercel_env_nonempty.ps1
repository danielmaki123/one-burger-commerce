$keys = @("DATABASE_URL", "DIRECT_URL", "NEXTAUTH_SECRET", "APP_ENV", "NODE_ENV", "NOTIFICATIONS_DRIVER")
foreach ($k in $keys) {
  $v = [Environment]::GetEnvironmentVariable($k)
  if ([string]::IsNullOrEmpty($v)) {
    Write-Output "$k=present_empty_or_missing"
  } else {
    Write-Output "$k=present_nonempty"
  }
}
