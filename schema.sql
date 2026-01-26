CREATE DATABASE IF NOT EXISTS telco_lookup;
USE telco_lookup;

-- Tabla de rangos de números (más eficiente)
CREATE TABLE numero_ranges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    range_start BIGINT NOT NULL,
    range_end BIGINT NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    nrn VARCHAR(10),
    type VARCHAR(50), -- MOBILE, FIXED, PREMIUM, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_range (range_start, range_end),
    INDEX idx_start (range_start),
    INDEX idx_end (range_end),
    INDEX idx_operator (operator_name)
);

-- Tabla de caché para búsquedas específicas (para ahorrar tiempo)
CREATE TABLE operators_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    nrn VARCHAR(10),
    is_ported BOOLEAN DEFAULT FALSE,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (phone_number)
);

-- Tabla de portabilidad (números que cambiaron de operador)
CREATE TABLE ported_numbers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    original_operator VARCHAR(100) NOT NULL,
    current_operator VARCHAR(100) NOT NULL,
    ported_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    INDEX idx_number (phone_number),
    INDEX idx_operators (original_operator, current_operator)
);

-- Tabla de historial de búsquedas
CREATE TABLE search_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(15) NOT NULL,
    operator_found VARCHAR(100),
    search_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50), -- 'RANGE', 'CACHE', 'HLR', 'API'
    response_time_ms INT,
    success BOOLEAN,
    ip_address VARCHAR(45),
    INDEX idx_phone (phone_number),
    INDEX idx_date (search_date),
    INDEX idx_operator (operator_found)
);

-- Tabla de spam/números sospechosos
CREATE TABLE spam_numbers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    spam_score INT DEFAULT 0, -- 0-100
    category VARCHAR(50), -- SPAM, FRAUD, ROBOCALL, etc.
    reports INT DEFAULT 0,
    last_reported TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(100), -- De dónde viene la info
    INDEX idx_number (phone_number),
    INDEX idx_score (spam_score)
);

-- Tabla de API keys para control de acceso
CREATE TABLE api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    user_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    requests_limit INT DEFAULT 10000,
    requests_used INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (api_key)
);

-- Tabla de logs
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_date (created_at)
);  