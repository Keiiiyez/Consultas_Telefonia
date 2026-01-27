# 📱 HDV Contact S.A.C. - Sistema de Consulta de Operadores Telefónicos
(sistema explicado por una ia pq i cant explain nada ;D)
- Un sistema completo para consultar, gestionar y verificar números telefónicos españoles con detección de operador, portabilidad, spam y análisis avanzado.

## ✨ Características

- 🔍 **Búsqueda Rápida** - Identifica el operador de cualquier número español (34XXXXXXXXX)
- 🔐 **Autenticación JWT** - Panel admin seguro con tokens de 24 horas
- 📊 **Estadísticas Públicas** - Todos los usuarios ven análisis en tiempo real sin login
- 📞 **Reportar Portabilidades** - Usuarios pueden reportar cambios de operador directamente
- 💾 **Gestión de Portabilidades** - Actualiza operadores cuando hay cambios de proveedor
- 🚫 **Detección de Spam** - Reporta y gestiona números de spam/fraude
- 📤 **Importar CSV** - Carga masiva de números desde archivo
- ➕ **Agregar Números** - Gestión individual de números y rangos
- 🔑 **API Keys** - Control de acceso con claves de API personalizadas
- 📋 **Logs de Actividad** - Registro completo de todas las operaciones
- ⚡ **Rate Limiting** - Protección contra abuso de API (100 req/15min por IP)

## 🚀 Instalación

### Requisitos
- Node.js v14+
- MySQL 5.7+
- npm

### Pasos

1. **Clonar o descargar el proyecto**
```bash
cd tu_ruta_del_proyecto
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar base de datos**
```bash
mysql -u root -p < schema.sql
```

4. **Configurar variables de entorno** (crear archivo `.env`)
```
ADMIN_PASSWORD=tu_contraseña_segura
JWT_SECRET=tu_clave_secreta_aleatoria_fuerte
DB_HOST=localhost
DB_USER=tu_usuario_db
DB_PASSWORD=tu_contraseña_db
DB_NAME=telco_lookup
PORT=3000

# Vonage (Opcional - Plan Gratis - Basic Lookup)
# Si deseas usar verificación externa de números
# Obtén tus claves en: https://dashboard.nexmo.com/
# VONAGE_API_KEY=tu_api_key
# VONAGE_API_SECRET=tu_api_secret
```
⚠️ **Importante:** Usa contraseñas fuertes y únicas. Nunca compartas el archivo `.env`.

5. **Iniciar el servidor**
```bash
npm start
```

El servidor estará disponible en: **http://localhost:3000**

## 📖 Guía de Uso

### 🏠 Página Principal (Index)
1. Accede a **http://localhost:3000**
2. Ingresa un número telefónico (formato: 34XXXXXXXXX)
3. Presiona "Buscar" para ver:
   - Operador actual
   - NRN (Número de Ruta de Numeración)
   - Tipo de línea (móvil, fija, etc.)
   - Información de portabilidad
   - Estado spam

#### 📊 Estadísticas Públicas
- Visualiza en tiempo real sin necesidad de login
- Total de búsquedas realizadas
- Búsquedas exitosas
- Cantidad de operadores disponibles
- Tiempo promedio de respuesta
- Top 6 operadores más buscados con porcentajes

#### 🔄 Reportar Cambio de Operador
- Reporta cambios de portabilidad directamente
- Campos: número telefónico, operador anterior, nuevo operador
- Se registra automáticamente en la base de datos
- Las estadísticas se actualizan en tiempo real

### 🔐 Panel de Administración

#### Acceso
1. Haz clic en "Acceso Admin" en la página principal
2. Ingresa tu contraseña de administrador (configurable en `.env`)
3. Se abrirá el dashboard

#### Pestañas Disponibles

**📊 Estadísticas**
- Búsquedas totales realizadas
- Tasa de éxito/fallo
- Tiempo promedio de respuesta
- Gráfico de búsquedas por operador
- Top 10 números más buscados

**📞 Portabilidades**
- Reporta cambios de operador
- Visualiza portabilidades registradas
- Actualiza operadores en la base de datos
- Se refleja automáticamente en búsquedas

**📱 Gestionar Números**

*Importar CSV:*
- Carga múltiples números desde archivo
- Formato CSV: `phone_number,operator_name,nrn,type`
- Ejemplo:
  ```
  phone_number,operator_name,nrn,type
  34600000000,Movistar,214,MOBILE
  34700000000,Vodafone,222,MOBILE
  34900000000,Orange,214,MOBILE
  ```

*Agregar Números Individuales:*
- Formulario para agregar un número específico
- Selecciona operador (Movistar, Vodafone, Orange, Yoigo, MVNO, Otro)
- Define el tipo (MOBILE, FIXED, PREMIUM)

**🚫 Spam/Fraude**
- Reporta números como spam
- Categorías: SPAM, FRAUD, ROBOCALL, etc.
- Puntuación de spam (0-100)
- Historial de reportes

**🔑 API Keys**
- Crea nuevas claves de acceso
- Controla límites de requests por aplicación
- Activa/desactiva claves
- Visualiza uso de cada clave

**📋 Logs**
- Registro de todas las operaciones
- Acciones: LOGIN, SEARCH, UPDATE, etc.
- Filtrado por fecha y acción
- Información detallada de cambios

**🛰️ Verificar Vonage** (NUEVO - Opcional)
- Verifica números con Vonage en tiempo real (Gratis)
- Información: Operador, tipo de línea, país
- Comparar con BD para detectar discrepancias
- Recibe recomendaciones de actualización
- ℹ️ **Requiere configuración de claves Vonage en `.env`**
- Ver [VONAGE_SETUP.md](VONAGE_SETUP.md) para instrucciones

## 🔗 API Endpoints

### Endpoints Públicos (sin autenticación)

```bash
# Buscar operador de un número
GET /api/lookup/:number

# Información completa del número
GET /api/number-info/:number

# Verificar portabilidad
GET /api/porting/:number

# Verificar si es spam
GET /api/spam-check/:number

# Estadísticas públicas (real-time)
GET /api/public/stats
Response: {
  "total_searches": 1234,
  "successful_searches": 1100,
  "operator_count": 5,
  "average_response_time": 45.2,
  "top_operators": [
    {"operator_found": "Movistar", "search_count": 450},
    {"operator_found": "Vodafone", "search_count": 380}
  ]
}

# Reportar cambio de portabilidad (público)
POST /api/public/porting/report
Body: {
  "phoneNumber": "34600123456",
  "currentOperator": "Movistar",
  "newOperator": "Vodafone"
}
# Verificar número con Vonage (Gratis - Basic) *Opcional*
GET /api/vonage/verify/:number
Response: {
  "success": true,
  "internationalFormat": "+34 600 123 456",
  "nationalFormat": "600 123 456",
  "carrierName": "Movistar",
  "numberType": "mobile",
  "countryCode": "ES",
  "countryName": "Spain",
  "source": "vonage_basic"
}
*Requiere VONAGE_API_KEY y VONAGE_API_SECRET en .env*

# Comparar número con BD y Vonage *Opcional*
GET /api/vonage/compare/:number/:dbOperator
Response: {
  "compared": true,
  "vonageInfo": {...},
  "dbOperator": "Movistar",
  "match": true/false,
  "message": "Operadores coinciden o discrepancia detectada",
  "recommendation": "opcional - si hay discrepancia"
}
*Requiere VONAGE_API_KEY y VONAGE_API_SECRET en .env*
# Health check
GET /api/health
```

### Endpoints Admin (requieren JWT)

```bash
# Login (generar token)
POST /api/admin/login
Body: { "password": "tu_contraseña_admin" }

# Verificar token
GET /api/admin/verify

# Estadísticas (admin - con más detalles)
GET /api/admin/stats

# Portabilidades
GET /api/admin/portings
POST /api/admin/porting/update
DELETE /api/admin/porting/:id

# Números
POST /api/admin/numbers/import-csv
POST /api/admin/numbers/add
GET /api/admin/numbers/recent

# Spam
GET /api/admin/spam
POST /api/admin/spam/report

# API Keys
GET /api/admin/keys
POST /api/admin/keys/create
DELETE /api/admin/keys/:id
PATCH /api/admin/keys/:id/toggle

# Logs
GET /api/admin/logs
```

## 📁 Estructura del Proyecto

```
Consultastelefonía/
├── public/
│   ├── index.html           # Página principal
│   ├── admin.html           # Dashboard admin
│   └── admin-login.html     # Página de login
├── services/
│   ├── lookupService.js     # Lógica de búsqueda
│   ├── advancedServices.js  # Servicios avanzados
│   └── rateLimiter.js       # Rate limiting
├── config/
│   └── db.js               # Conexión MySQL
├── server.js               # Express server
├── schema.sql              # Esquema de BD
├── package.json            # Dependencias
├── .env                    # Variables de entorno
└── README.md               # Este archivo
```

## 🗄️ Esquema de Base de Datos

**numero_ranges** - Rangos de números por operador
**operators_cache** - Cache de búsquedas
**ported_numbers** - Registro de portabilidades
**search_history** - Historial de búsquedas
**spam_numbers** - Números reportados como spam
**api_keys** - Claves de API
**activity_logs** - Log de todas las actividades

## 🔒 Seguridad

- ✅ Autenticación JWT con 24h de expiración
- ✅ Rate limiting: 100 requests/15 minutos por IP
- ✅ Validación de entrada en todos los endpoints
- ✅ Logs de auditoría completos
- ✅ CORS configurado
- ✅ Variables de entorno para credenciales

⚠️ **Para producción:**
- Usar contraseñas largas y complejas (mínimo 16 caracteres)
- Usar HTTPS en lugar de HTTP
- Instalar Tailwind CSS localmente (no usar CDN)
- Nunca expongas archivos `.env` en repositorios públicos
- Usa secrets management para credenciales en CI/CD
- Mantén las dependencias actualizadas
- Configura firewall para restringir acceso a MySQL

## 📦 Dependencias

- **express** - Framework web
- **mysql2** - Driver MySQL
- **jsonwebtoken** - Autenticación JWT
- **dotenv** - Gestión de variables
- **axios** - HTTP client
- **chart.js** - Gráficos en frontend
- **tailwindcss** - Estilos CSS

## 🛠️ Scripts Disponibles

```bash
npm start              # Inicia el servidor
npm run seed-ranges    # Carga datos iniciales de rangos
npm run import         # Importa datos desde CSV
```

## 📝 Ejemplos de Uso

### Ejemplo 1: Buscar un número
```javascript
fetch('http://localhost:3000/api/lookup/34XXXXXXXXX')
  .then(r => r.json())
  .then(data => console.log(data));
```

### Ejemplo 2: Agregar número por API Admin
```javascript
const token = 'tu_jwt_token';
fetch('http://localhost:3000/api/admin/numbers/add', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone_number: '34XXXXXXXXX',
    operator_name: 'Movistar',
    type: 'MOBILE'
  })
})
.then(r => r.json())
.then(data => console.log(data));
```

## 🐛 Troubleshooting

**Error: "Token inválido"**
- El token ha expirado (24 horas)
- Vuelve a hacer login

**Error: "Endpoint no encontrado"**
- Reinicia el servidor después de cambios
- Verifica la URL del endpoint

**Los números no se actualizan**
- Limpia el cache manualmente o espera a que expire
- Reinicia el servidor

**Base de datos no conecta**
- Verifica que MySQL esté ejecutándose
- Comprueba las credenciales en `.env`
- Asegúrate de que la BD `telco_lookup` existe

## 📞 Soporte

Para reportar problemas o sugerencias, crea un issue en el repositorio.

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.

---

**Última actualización:** Enero 2026
**Versión:** 2.0.0

### 🆕 Cambios en v2.0.0
- ✨ Endpoint público de estadísticas `/api/public/stats` 
- ✨ Endpoint público para reportar portabilidades `/api/public/porting/report`
- 📊 Estadísticas en tiempo real en página principal sin requerir login
- 🔄 Usuarios pueden reportar cambios de operador directamente desde index.html
- 🔧 Corrección en nombres de campos de base de datos
- 📱 Mejor experiencia UX para usuarios sin permisos admin
- 🔐 Endpoints públicos con validación de entrada para seguridad
- 🛰️ **Integración Vonage (opcional)** - Verifica números con API externa (requiere configuración)
