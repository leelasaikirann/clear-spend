# ==========================================================
# Clear Spend Native REST API and Web Server
# Powers database authentication with SSMS (Microsoft SQL Server)
# Zero extra installation required: runs natively on Windows
# ==========================================================

param (
    [int]$Port = 5000,
    [string[]]$DbServers = @(".\MSSQLSERVER01", ".\MSSQLSERVER02"),
    [string]$Database = "ClearSpendDB"
)

Add-Type -AssemblyName System.Data
Add-Type -AssemblyName System.Web

$RootDir = (Get-Item (Join-Path $PSScriptRoot "..")).FullName

# Password Hashing Helper (SHA-256 + Salt)
function Compute-Hash {
    param([string]$Password, [string]$Salt)
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Password + $Salt)
    $hash = $hasher.ComputeHash($bytes)
    return [BitConverter]::ToString($hash) -replace '-'
}

# Database Query Helper (Returns Array of PSCustomObject)
function Invoke-SqlQuery {
    param([string]$Query, [hashtable]$Params = @{})
    foreach ($srv in $DbServers) {
        try {
            $connStr = "Server=$srv;Database=$Database;Integrated Security=True;TrustServerCertificate=True"
            $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
            $conn.Open()
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = $Query
            foreach ($key in $Params.Keys) {
                $val = if ($null -eq $Params[$key]) { [DBNull]::Value } else { $Params[$key] }
                $null = $cmd.Parameters.AddWithValue($key, $val)
            }
            $reader = $cmd.ExecuteReader()
            $results = @()
            while ($reader.Read()) {
                $row = [ordered]@{}
                for ($i = 0; $i -lt $reader.FieldCount; $i++) {
                    $name = $reader.GetName($i)
                    $val = $reader.GetValue($i)
                    if ($val -is [DBNull]) {
                        $row[$name] = $null
                    } else {
                        $row[$name] = $val
                    }
                }
                $results += [PSCustomObject]$row
            }
            $reader.Close()
            $conn.Close()
            return ,$results
        }
        catch {
            Write-Host "[SQL QUERY ERROR on $srv] $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    return ,@()
}

# Database Execute NonQuery Helper (Executes on all available instances)
function Invoke-SqlExecute {
    param([string]$Query, [hashtable]$Params = @{})
    $success = $false
    foreach ($srv in $DbServers) {
        try {
            $connStr = "Server=$srv;Database=$Database;Integrated Security=True;TrustServerCertificate=True"
            $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
            $conn.Open()
            $cmd = $conn.CreateCommand()
            $cmd.CommandText = $Query
            foreach ($key in $Params.Keys) {
                $val = if ($null -eq $Params[$key]) { [DBNull]::Value } else { $Params[$key] }
                $null = $cmd.Parameters.AddWithValue($key, $val)
            }
            $null = $cmd.ExecuteNonQuery()
            $conn.Close()
            $success = $true
        }
        catch {
            Write-Host "[SQL EXEC ERROR on $srv] $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    return $success
}

# Resolve target UserId helper
function Get-TargetUserId {
    param($userIdVal, [string]$usernameVal)
    $targetUid = 0

    if ($usernameVal) {
        try {
            $byName = Invoke-SqlQuery -Query "SELECT UserId FROM Users WHERE Username = @un" -Params @{ "@un" = $usernameVal }
            if ($byName.Count -gt 0) {
                $targetUid = [int]$byName[0].UserId
                return $targetUid
            }
        } catch {}
    }

    if ($userIdVal) {
        try {
            $parsedLong = 0
            if ([long]::TryParse($userIdVal.ToString(), [ref]$parsedLong)) {
                if ($parsedLong -le [int]::MaxValue -and $parsedLong -gt 0) {
                    $uCheck = Invoke-SqlQuery -Query "SELECT UserId FROM Users WHERE UserId = @uid" -Params @{ "@uid" = [int]$parsedLong }
                    if ($uCheck.Count -gt 0) {
                        $targetUid = [int]$uCheck[0].UserId
                        return $targetUid
                    }
                }
            }
        } catch {}
    }

    # Fallback to user Sai or latest user
    $saiUser = Invoke-SqlQuery -Query "SELECT UserId FROM Users WHERE Username = 'Sai'"
    if ($saiUser.Count -gt 0) {
        return [int]$saiUser[0].UserId
    }

    $anyUser = Invoke-SqlQuery -Query "SELECT TOP 1 UserId FROM Users ORDER BY UserId DESC"
    if ($anyUser.Count -gt 0) {
        return [int]$anyUser[0].UserId
    }

    return 1
}

# Helper to save/upsert a single transaction
function Save-TransactionRow {
    param($t, [int]$targetUid)

    if (-not $t) { return $false }

    $rowUid = $targetUid
    if ($t.username) {
        $found = Get-TargetUserId -userIdVal $null -usernameVal $t.username.ToString()
        if ($found -gt 0) { $rowUid = $found }
    }

    $parsedAmount = 0
    if ($t.amount) {
        try { $parsedAmount = [decimal]$t.amount } catch {}
    }

    $parsedDate = Get-Date
    if ($t.date) {
        try { $parsedDate = [DateTime]::Parse($t.date.ToString()) } catch {}
    }

    $txId = if ($t.id) { $t.id.ToString() } else { "tx_" + [Guid]::NewGuid().ToString("N") }
    if ($txId.Length -gt 64) { $txId = $txId.Substring(0, 64) }

    $txType = if ($t.type) { $t.type.ToString() } else { "expense" }
    if ($txType.Length -gt 20) { $txType = $txType.Substring(0, 20) }

    $txTitle = if ($t.title) { $t.title.ToString() } else { "Expense" }
    if ($txTitle.Length -gt 150) { $txTitle = $txTitle.Substring(0, 150) }

    $txCat = if ($t.category) { $t.category.ToString() } else { "other_expense" }
    if ($txCat.Length -gt 50) { $txCat = $txCat.Substring(0, 50) }

    $txNotes = if ($t.notes) { $t.notes.ToString() } else { $null }
    if ($txNotes -and $txNotes.Length -gt 500) { $txNotes = $txNotes.Substring(0, 500) }

    $upsertQuery = @"
IF EXISTS (SELECT 1 FROM Transactions WHERE TransactionId = @id)
    UPDATE Transactions
    SET Type = @type, Title = @title, Amount = @amount, Category = @cat, Date = @date, Notes = @notes, UserId = @uid
    WHERE TransactionId = @id
ELSE
    INSERT INTO Transactions (TransactionId, UserId, Type, Title, Amount, Category, Date, Notes, CreatedAt)
    VALUES (@id, @uid, @type, @title, @amount, @cat, @date, @notes, GETDATE())
"@

    return Invoke-SqlExecute -Query $upsertQuery -Params @{
        "@id" = $txId
        "@uid" = $rowUid
        "@type" = $txType
        "@title" = $txTitle
        "@amount" = $parsedAmount
        "@cat" = $txCat
        "@date" = $parsedDate
        "@notes" = if ($txNotes) { $txNotes } else { [DBNull]::Value }
    }
}

# Send HTTP Response Helper
function Send-JsonResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [object]$Data,
        [int]$StatusCode = 200
    )
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")

    $json = $Data | ConvertTo-Json -Depth 5 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.ContentLength64 = $buffer.Length
    $Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $Response.OutputStream.Close()
}

# Mime types dictionary for static files
$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
}

# Initialize HTTP Listener
$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
}
catch {
    Write-Host "[ERROR] Could not start server on $prefix. Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Clear Spend Web and API Server Live" -ForegroundColor Green
Write-Host " Dashboard URL : $prefix" -ForegroundColor Yellow
Write-Host " SQL Databases : MSSQLSERVER01 & MSSQLSERVER02 -> $Database" -ForegroundColor Yellow
Write-Host " Press Ctrl + C to stop the server" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $method = $request.HttpMethod
        $path = $request.Url.AbsolutePath
        $clientIp = $request.RemoteEndPoint.Address.ToString()
        $userAgent = $request.UserAgent

        # Handle CORS Preflight
        if ($method -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
            $response.OutputStream.Close()
            continue
        }

        # --- Static File Serving (if not starting with /api/) ---
        if (-not $path.StartsWith("/api/")) {
            $relPath = if ($path -eq "/" -or $path -eq "") { "index.html" } else { $path.TrimStart('/') }
            $relPath = [System.Uri]::UnescapeDataString($relPath)
            $filePath = Join-Path $RootDir $relPath

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { "application/octet-stream" }
                $fileBytes = [System.IO.File]::ReadAllBytes($filePath)

                $response.StatusCode = 200
                $response.ContentType = $contentType
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.ContentLength64 = $fileBytes.Length
                $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
                $response.OutputStream.Close()
                continue
            }
        }

        # Parse Request Body
        $body = $null
        if ($request.HasEntityBody) {
            $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
            $rawBody = $reader.ReadToEnd()
            $reader.Close()
            if ($rawBody) {
                try {
                    $body = $rawBody | ConvertFrom-Json
                } catch {}
            }
        }

        Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] $method $path" -ForegroundColor White

        # --- Router ---
        
        # 1. Healthcheck
        if ($path -eq "/api/health" -and $method -eq "GET") {
            Send-JsonResponse -Response $response -Data @{
                status = "ok"
                server = "ClearSpend SQL Server API"
                database = $Database
                timestamp = [DateTime]::UtcNow.ToString("o")
            }
            continue
        }

        # 2. Register New User
        if ($path -eq "/api/auth/register" -and $method -eq "POST") {
            if (-not $body.username -or -not $body.email -or -not $body.password) {
                Send-JsonResponse -Response $response -StatusCode 400 -Data @{
                    success = $false
                    error = "Username, email, and password are required."
                }
                continue
            }

            $uName = $body.username.Trim()
            $uEmail = $body.email.Trim().ToLower()
            $uPass = $body.password

            # Check if username or email already exists
            $existing = Invoke-SqlQuery -Query "SELECT UserId FROM Users WHERE Username = @u OR Email = @e" -Params @{
                "@u" = $uName
                "@e" = $uEmail
            }

            if ($existing.Count -gt 0) {
                Send-JsonResponse -Response $response -StatusCode 409 -Data @{
                    success = $false
                    error = "Username or email is already registered."
                }
                continue
            }

            # Generate Salt and Hash
            $salt = [Guid]::NewGuid().ToString("N")
            $hash = Compute-Hash -Password $uPass -Salt $salt

            # Insert User and get UserId
            $insertQuery = @"
INSERT INTO Users (Username, Email, PasswordHash, Salt, CreatedAt, LastLoginAt)
OUTPUT INSERTED.UserId, INSERTED.Username, INSERTED.Email
VALUES (@u, @e, @h, @s, GETDATE(), GETDATE())
"@
            $newRows = Invoke-SqlQuery -Query $insertQuery -Params @{
                "@u" = $uName
                "@e" = $uEmail
                "@h" = $hash
                "@s" = $salt
            }

            $userId = [int]$newRows[0].UserId

            # Log registration activity
            $null = Invoke-SqlExecute -Query "INSERT INTO UserLoginLogs (UserId, Username, LoginTimestamp, IpAddress, UserAgent, Status) VALUES (@uid, @uname, GETDATE(), @ip, @ua, 'REGISTER_LOGIN')" -Params @{
                "@uid" = $userId
                "@uname" = $uName
                "@ip" = $clientIp
                "@ua" = $userAgent
            }

            Write-Host " -> Registered new user: $uName (ID: $userId)" -ForegroundColor Green

            Send-JsonResponse -Response $response -StatusCode 201 -Data @{
                success = $true
                message = "Account created successfully!"
                user = @{
                    userId = $userId
                    username = $uName
                    email = $uEmail
                }
            }
            continue
        }

        # 3. User Login
        if ($path -eq "/api/auth/login" -and $method -eq "POST") {
            if (-not $body.username -or -not $body.password) {
                Send-JsonResponse -Response $response -StatusCode 400 -Data @{
                    success = $false
                    error = "Username/email and password are required."
                }
                continue
            }

            $loginIdent = $body.username.Trim()
            $loginPass = $body.password

            # Find user
            $userResult = Invoke-SqlQuery -Query "SELECT UserId, Username, Email, PasswordHash, Salt FROM Users WHERE Username = @ident OR Email = @ident" -Params @{
                "@ident" = $loginIdent
            }

            if ($userResult.Count -eq 0) {
                $null = Invoke-SqlExecute -Query "INSERT INTO UserLoginLogs (UserId, Username, LoginTimestamp, IpAddress, UserAgent, Status) VALUES (NULL, @uname, GETDATE(), @ip, @ua, 'FAILED_USER_NOT_FOUND')" -Params @{
                    "@uname" = $loginIdent
                    "@ip" = $clientIp
                    "@ua" = $userAgent
                }

                Write-Host " -> Failed login for: $loginIdent (user not found)" -ForegroundColor Red
                Send-JsonResponse -Response $response -StatusCode 401 -Data @{
                    success = $false
                    error = "Invalid username/email or password."
                }
                continue
            }

            $user = $userResult[0]
            $storedHash = $user.PasswordHash
            $storedSalt = $user.Salt
            $calcHash = Compute-Hash -Password $loginPass -Salt $storedSalt

            if ($calcHash -ne $storedHash) {
                $null = Invoke-SqlExecute -Query "INSERT INTO UserLoginLogs (UserId, Username, LoginTimestamp, IpAddress, UserAgent, Status) VALUES (@uid, @uname, GETDATE(), @ip, @ua, 'FAILED_WRONG_PASSWORD')" -Params @{
                    "@uid" = [int]$user.UserId
                    "@uname" = $user.Username
                    "@ip" = $clientIp
                    "@ua" = $userAgent
                }

                Write-Host " -> Failed login for: $($user.Username) (wrong password)" -ForegroundColor Red
                Send-JsonResponse -Response $response -StatusCode 401 -Data @{
                    success = $false
                    error = "Invalid username/email or password."
                }
                continue
            }

            # Login successful: Update LastLoginAt
            $null = Invoke-SqlExecute -Query "UPDATE Users SET LastLoginAt = GETDATE() WHERE UserId = @uid" -Params @{
                "@uid" = [int]$user.UserId
            }

            # Log success event in UserLoginLogs
            $null = Invoke-SqlExecute -Query "INSERT INTO UserLoginLogs (UserId, Username, LoginTimestamp, IpAddress, UserAgent, Status) VALUES (@uid, @uname, GETDATE(), @ip, @ua, 'SUCCESS')" -Params @{
                "@uid" = [int]$user.UserId
                "@uname" = $user.Username
                "@ip" = $clientIp
                "@ua" = $userAgent
            }

            Write-Host " -> Successful login: $($user.Username)" -ForegroundColor Green

            Send-JsonResponse -Response $response -StatusCode 200 -Data @{
                success = $true
                message = "Login successful"
                user = @{
                    userId = [int]$user.UserId
                    username = $user.Username
                    email = $user.Email
                }
            }
            continue
        }

        # 4. View Login Logs (Admin endpoint for SSMS verification)
        if ($path -eq "/api/auth/logs" -and $method -eq "GET") {
            $logs = Invoke-SqlQuery -Query "SELECT TOP 50 LogId, UserId, Username, LoginTimestamp, IpAddress, Status FROM UserLoginLogs ORDER BY LoginTimestamp DESC"
            Send-JsonResponse -Response $response -Data @{
                success = $true
                count = $logs.Count
                logs = $logs
            }
            continue
        }

        # 5. List All Users (SSMS verification)
        if ($path -eq "/api/users" -and $method -eq "GET") {
            $users = Invoke-SqlQuery -Query "SELECT UserId, Username, Email, CreatedAt, LastLoginAt FROM Users ORDER BY CreatedAt DESC"
            Send-JsonResponse -Response $response -Data @{
                success = $true
                count = $users.Count
                users = $users
            }
            continue
        }

        # 6. User Transactions Sync (GET) - Fetches all users by default
        if ($path -eq "/api/transactions" -and $method -eq "GET") {
            $uidParam = $request.QueryString["userId"]
            $unParam = $request.QueryString["username"]
            $userParam = $request.QueryString["user"]
            $onlyMine = $request.QueryString["onlyMine"]

            $filterUser = $null
            if ($userParam -and $userParam -ne "all") {
                $filterUser = $userParam
            } elseif ($onlyMine -eq "true" -or $onlyMine -eq "1") {
                if ($unParam) { $filterUser = $unParam }
                elseif ($uidParam) {
                    $uCheck = Invoke-SqlQuery -Query "SELECT Username FROM Users WHERE UserId = @uid" -Params @{ "@uid" = [int]$uidParam }
                    if ($uCheck.Count -gt 0) { $filterUser = $uCheck[0].Username }
                }
            }

            if ($filterUser) {
                $txList = Invoke-SqlQuery -Query @"
SELECT 
    t.TransactionId,
    t.UserId,
    ISNULL(u.Username, 'User') AS Username,
    t.Type,
    t.Title,
    t.Amount,
    t.Category,
    CONVERT(VARCHAR(10), t.Date, 120) AS Date,
    ISNULL(t.Notes, '') AS Notes
FROM Transactions t
LEFT JOIN Users u ON t.UserId = u.UserId
WHERE u.Username = @uname
ORDER BY t.Date DESC, t.CreatedAt DESC
"@ -Params @{ "@uname" = $filterUser }
            } else {
                # DEFAULT: FETCH ALL USERS TRANSACTIONS
                $txList = Invoke-SqlQuery -Query @"
SELECT 
    t.TransactionId,
    t.UserId,
    ISNULL(u.Username, 'User') AS Username,
    t.Type,
    t.Title,
    t.Amount,
    t.Category,
    CONVERT(VARCHAR(10), t.Date, 120) AS Date,
    ISNULL(t.Notes, '') AS Notes
FROM Transactions t
LEFT JOIN Users u ON t.UserId = u.UserId
ORDER BY t.Date DESC, t.CreatedAt DESC
"@
            }

            Send-JsonResponse -Response $response -Data @{
                success = $true
                count = $txList.Count
                transactions = $txList
            }
            continue
        }

        # 7. User Transactions Sync (Single POST)
        if ($path -eq "/api/transactions" -and $method -eq "POST") {
            if (-not $body.transaction) {
                Send-JsonResponse -Response $response -StatusCode 400 -Data @{
                    success = $false
                    error = "Transaction object is required."
                }
                continue
            }

            $targetUid = Get-TargetUserId -userIdVal $body.userId -usernameVal $body.username
            $ok = Save-TransactionRow -t $body.transaction -targetUid $targetUid

            if ($ok) {
                Write-Host " -> Saved transaction '$($body.transaction.title)' for UserId $targetUid in SSMS" -ForegroundColor Green
                Send-JsonResponse -Response $response -Data @{
                    success = $true
                    message = "Transaction saved to database"
                    userId = $targetUid
                }
            } else {
                Send-JsonResponse -Response $response -StatusCode 500 -Data @{
                    success = $false
                    error = "Failed to save transaction to database"
                }
            }
            continue
        }

        # 8. User Transactions Bulk Sync (POST /api/transactions/bulk)
        if ($path -eq "/api/transactions/bulk" -and $method -eq "POST") {
            if (-not $body.transactions -or -not ($body.transactions -is [array])) {
                Send-JsonResponse -Response $response -StatusCode 400 -Data @{
                    success = $false
                    error = "Transactions array is required."
                }
                continue
            }

            $targetUid = Get-TargetUserId -userIdVal $body.userId -usernameVal $body.username
            $savedCount = 0

            foreach ($item in $body.transactions) {
                $saved = Save-TransactionRow -t $item -targetUid $targetUid
                if ($saved) { $savedCount++ }
            }

            Write-Host " -> Bulk synced $savedCount transactions for UserId $targetUid in SSMS" -ForegroundColor Green

            Send-JsonResponse -Response $response -Data @{
                success = $true
                syncedCount = $savedCount
                userId = $targetUid
                message = "Synced $savedCount transactions to database"
            }
            continue
        }

        # 9. User Transactions Delete (DELETE)
        if ($path -eq "/api/transactions" -and $method -eq "DELETE") {
            $delId = $request.QueryString["id"]
            if ($delId) {
                $null = Invoke-SqlExecute -Query "DELETE FROM Transactions WHERE TransactionId = @id" -Params @{
                    "@id" = $delId
                }
                Write-Host " -> Deleted transaction $delId from database" -ForegroundColor Yellow
            }
            Send-JsonResponse -Response $response -Data @{
                success = $true
                message = "Transaction deleted from database"
            }
            continue
        }

        # 404 Route Not Found
        Send-JsonResponse -Response $response -StatusCode 404 -Data @{
            error = "Endpoint not found: $path"
        }
    }
    catch {
        Write-Host "[ERROR] Request processing failed: $_" -ForegroundColor Red
        try {
            Send-JsonResponse -Response $response -StatusCode 500 -Data @{
                error = "Internal server error: $_"
            }
        } catch {}
    }
}
