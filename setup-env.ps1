# Setup script for .env file
$envContent = @"
# Supabase Configuration
VITE_SUPABASE_URL=https://mzsafoaevlampvzqrrmz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16c2Fmb2FldmxhbXB2enFycm16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTA0NDIsImV4cCI6MjA3ODI2NjQ0Mn0.XBPGs_C2VPp4TPACagJ85cdzkFJAv0WZ58R6_2wPww8

# Gemini API Key
VITE_GEMINI_API_KEY=AIzaSyDRkO31dq3n5R5KUFVbLgEXQF9yXrx455c
"@

$envContent | Out-File -FilePath ".env" -Encoding utf8
Write-Host ".env file created successfully!" -ForegroundColor Green

