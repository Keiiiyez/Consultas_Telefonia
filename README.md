# 📱 Telco Lookup - Sistema de Consulta de Operadores Telefónicos

Un sistema completo para consultar, gestionar y verificar números telefónicos españoles con detección de operador, portabilidad, spam y análisis avanzado.

## ✨ Características

- 🔍 **Búsqueda Rápida** - Identifica el operador de cualquier número español (34XXXXXXXXX)
- 🔐 **Autenticación JWT** - Panel admin seguro con tokens de 24 horas
- 📊 **Estadísticas Detalladas** - Análisis de búsquedas por operador, tiempos de respuesta
- 📞 **Gestión de Portabilidades** - Actualiza operadores cuando hay cambios de proveedor
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
cd "c:\Users\W10\Documents\Consultastelefonía"
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
ADMIN_PASSWORD=admin123
JWT_SECRET=tu_clave_secreta_super_segura_2026
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=telco_lookup
PORT=3000
```

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

### 🔐 Panel de Administración

#### Acceso
1. Haz clic en "Acceso Admin" en la página principal
2. Ingresa la contraseña (por defecto: `admin123`)
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

# Health check
GET /api/health
```

### Endpoints Admin (requieren JWT)

```bash
# Login (generar token)
POST /api/admin/login
Body: { "password": "admin123" }

# Estadísticas
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

# Verificar token
GET /api/admin/verify
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
- Cambiar `ADMIN_PASSWORD` y `JWT_SECRET` en `.env`
- Usar HTTPS en lugar de HTTP
- Instalar Tailwind CSS localmente (no usar CDN)
- Configurar variables de entorno seguras

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
fetch('http://localhost:3000/api/lookup/34600123456')
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
    phone_number: '34600000000',
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
**Versión:** 1.0.0
