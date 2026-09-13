-- ==========================================================
-- Clear Spend Database Schema
-- Compatible with Microsoft SQL Server 2016+ & SSMS
-- ==========================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ClearSpendDB')
BEGIN
    CREATE DATABASE [ClearSpendDB];
END
GO

USE [ClearSpendDB];
GO

-- 1. Users Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Users] (
        [UserId] INT IDENTITY(1,1) PRIMARY KEY,
        [Username] NVARCHAR(50) NOT NULL UNIQUE,
        [Email] NVARCHAR(100) NOT NULL UNIQUE,
        [PasswordHash] NVARCHAR(256) NOT NULL,
        [Salt] NVARCHAR(64) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [LastLoginAt] DATETIME2 NULL
    );
END
GO

-- 2. User Login Activity Log Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserLoginLogs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[UserLoginLogs] (
        [LogId] INT IDENTITY(1,1) PRIMARY KEY,
        [UserId] INT NULL FOREIGN KEY REFERENCES [dbo].[Users]([UserId]),
        [Username] NVARCHAR(50) NOT NULL,
        [LoginTimestamp] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [IpAddress] NVARCHAR(50) NULL,
        [UserAgent] NVARCHAR(255) NULL,
        [Status] NVARCHAR(20) NOT NULL -- 'SUCCESS', 'FAILED', 'LOGOUT'
    );
END
GO

-- 3. Transactions Table (User-scoped expenses & income)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Transactions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Transactions] (
        [TransactionId] NVARCHAR(64) PRIMARY KEY,
        [UserId] INT NOT NULL FOREIGN KEY REFERENCES [dbo].[Users]([UserId]) ON DELETE CASCADE,
        [Type] NVARCHAR(20) NOT NULL, -- 'expense' or 'income'
        [Title] NVARCHAR(150) NOT NULL,
        [Amount] DECIMAL(18, 2) NOT NULL,
        [Category] NVARCHAR(50) NOT NULL,
        [Date] DATE NOT NULL,
        [Notes] NVARCHAR(500) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

PRINT 'ClearSpendDB database and tables successfully configured.';
GO
