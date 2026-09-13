# ==========================================================
# Clear Spend Native REST API Server
# Powers database authentication with SSMS (Microsoft SQL Server)
# Zero extra installation required: runs natively on Windows
# ==========================================================

param (
    [int]$Port = 5000,
    [string]$DbServer = ".\MSSQLSERVER01",
    [string]$Database = "ClearSpendDB"
)

Add-Type -AssemblyName System.Data
Add-Type -AssemblyName System.Web

$ConnectionString = "Server=$DbServer;Database=$Database;Integrated Security=True;TrustServerCertificate=True"

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
    $conn = New-Object System.Data.SqlClient.SqlConnection($ConnectionString)
    try {
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
        return ,$results
    }
    finally {
        if ($conn.State -eq 'Open') { $conn.Close() }
    }
}

# Database Execute NonQuery Helper
function Invoke-SqlExecute {
    param([string]$Query, [hashtable]$Params = @{})
    $conn = New-Object System.Data.SqlClient.SqlConnection($ConnectionString)
    try {
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $Query
        foreach ($key in $Params.Keys) {
            $val = if ($null -eq $Params[$key]) { [DBNull]::Value } else { $Params[$key] }
            $null = $cmd.Parameters.AddWithValue($key, $val)
        }
        return $cmd.ExecuteNonQuery()
    }
    finally {
        if ($conn.State -eq 'Open') { $conn.Close() }
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
    $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")

    $json = $Data | ConvertTo-Json -Depth 5 -Compress
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.ContentLength64 = $buffer.Length
    $Response.OutputStream.Write($buffer, 0, $buffer.Length)
    $Response.OutputStream.Close()
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
Write-Host " Clear Spend API Server Live" -ForegroundColor Green
Write-Host " Listening on : $prefix" -ForegroundColor Yellow
Write-Host " SQL Database : $DbServer -> $Database" -ForegroundColor Yellow
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
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
            $response.OutputStream.Close()
            continue
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
                # Log failed attempt
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
                # Log failed password attempt
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

        # 6. User Transactions Sync (GET)
        if ($path -eq "/api/transactions" -and $method -eq "GET") {
            $uidParam = $request.QueryString["userId"]
            if (-not $uidParam) {
                Send-JsonResponse -Response $response -StatusCode 400 -Data @{
                    success = $false
                    error = "userId parameter is required."
                }
                continue
            }

            $txList = Invoke-SqlQuery -Query "SELECT TransactionId, Type, Title, Amount, Category, Date, Notes FROM Transactions WHERE UserId = @uid ORDER BY Date DESC" -Params @{
                "@uid" = [int]$uidParam
            }

            Send-JsonResponse -Response $response -Data @{
                success = $true
                count = $txList.Count
                transactions = $txList
            }
            continue
        }

        # 7. User Transactions Sync (POST)
        if ($path -eq "/api/transactions" -and $method -eq "POST") {
            if (-not $body.userId -or -not $body.transaction) {
                Send-JsonResponse -Response $response -StatusCode 400 -Data @{
                    success = $false
                    error = "userId and transaction object are required."
                }
                continue
            }

            $t = $body.transaction
            $null = Invoke-SqlExecute -Query @"
IF EXISTS (SELECT 1 FROM Transactions WHERE TransactionId = @id AND UserId = @uid)
    UPDATE Transactions SET Type = @type, Title = @title, Amount = @amount, Category = @cat, Date = @date, Notes = @notes WHERE TransactionId = @id AND UserId = @uid
ELSE
    INSERT INTO Transactions (TransactionId, UserId, Type, Title, Amount, Category, Date, Notes, CreatedAt)
    VALUES (@id, @uid, @type, @title, @amount, @cat, @date, @notes, GETDATE())
"@ -Params @{
                "@id" = $t.id
                "@uid" = [int]$body.userId
                "@type" = $t.type
                "@title" = $t.title
                "@amount" = [decimal]$t.amount
                "@cat" = $t.category
                "@date" = [DateTime]$t.date
                "@notes" = if ($t.notes) { $t.notes } else { [DBNull]::Value }
            }

            Send-JsonResponse -Response $response -Data @{
                success = $true
                message = "Transaction saved to database"
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
