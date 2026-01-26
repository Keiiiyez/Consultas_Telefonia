CREATE DATABASE IF NOT EXISTS telco_lookup;
USE telco_lookup;

CREATE TABLE operators_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    operator_name VARCHAR(100) NOT NULL,
    nrn VARCHAR(10), -- Network Routing Number (clave en España)
    is_ported BOOLEAN DEFAULT FALSE,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (phone_number) -- Para que la búsqueda sea instantánea
);  