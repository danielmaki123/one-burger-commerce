$keys = @("DATABASE_URL", "NEXTAUTH_SECRET", "APP_ENV", "NODE_ENV")
foreach ($k in $keys) {
  $v = [Environment]::GetEnvironmentVariable($k)
  if ([string]::IsNullOrEmpty($v)) {
    Write-Output "$k=present_empty_or_missing"
  } else {
    Write-Output "$k=present_nonempty"
  }
}
