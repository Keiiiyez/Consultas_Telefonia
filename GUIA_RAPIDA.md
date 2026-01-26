# 🚀 GUÍA RÁPIDA - Telco Lookup

## ⚡ Primeros Pasos

### 1️⃣ Instalación
```bash
npm install
```

### 2️⃣ Configurar Base de Datos
Ejecuta en MySQL:
```sql
-- Copiar todo el contenido de schema.sql
```

### 3️⃣ Cargar datos de operadores
```bash
npm run seed-ranges
```

### 4️⃣ Iniciar servidor
```bash
npm start
```

### 5️⃣ Acceder
- **Web**: http://localhost:3000
- **Admin**: http://localhost:3000/admin-login.html
- **Password**: `admin123` (cambiar en `.env`)

---

## 🔄 Flujo de Acceso

```
Usuario entra a index.html
         ↓
Ve opción "Acceder al Admin"
         ↓
Hace clic → admin-login.html
         ↓
Ingresa contraseña
         ↓
Si correcta → Genera JWT → Guarda en localStorage → Redirige a admin.html
Si incorrecta → Muestra error
         ↓
En admin.html:
- Verifica token
- Si válido → Carga dashboard
- Si inválido → Redirige a login
```

---

## 🔐 Seguridad

| Aspecto | Configuración |
|--------|----------------|
| **Contraseña** | `ADMIN_PASSWORD` en `.env` |
| **JWT Secret** | `JWT_SECRET` en `.env` |
| **Expiración Token** | 24 horas |
| **Rate Limiting** | 100 req/15 min por IP |
| **Almacenamiento Token** | localStorage (navegador) |

---

## 📁 Archivos Principales

| Archivo | Función |
|---------|---------|
| `index.html` | Web pública con búsqueda |
| `admin-login.html` | Formulario de login |
| `admin.html` | Dashboard administrativo |
| `server.js` | Backend con API y autenticación |
| `.env` | Variables de entorno (editar aquí) |

---

## 🔧 Cambiar Contraseña Admin

Edita `.env`:
```env
ADMIN_PASSWORD=tu_nueva_contraseña_aqui
JWT_SECRET=tu_clave_secreta_super_segura
```

Reinicia el servidor y ya está.

---

## 📊 Funcionalidades del Admin

✅ **Estadísticas** - Búsquedas, operadores, tiempos  
✅ **Portabilidades** - Reportar cambios de operador  
✅ **Spam** - Reportar números fraudulentos  
✅ **Logs** - Historial de actividad  
✅ **API Keys** - Gestionar acceso (en desarrollo)

---

## 🐛 Troubleshooting

**Error: "No matching version found for jsonwebtoken"**
```bash
# Ya está solucionado en package.json
npm install
```

**Error: "Cannot find module"**
```bash
npm install
```

**Error: "Cannot login"**
- Verifica que MySQL esté corriendo
- Verifica que schema.sql se ejecutó
- Revisa que `.env` tenga la contraseña correcta

**El token no funciona**
- Borra localStorage: `localStorage.clear()`
- Intenta login de nuevo

---

## 🎯 Próximos Pasos

1. ✅ Cambiar contraseña en `.env`
2. ✅ Cambiar JWT_SECRET en `.env`
3. ✅ Hacer backup de datos importantes
4. ✅ Cambiar los rangos de operadores según tus necesidades
5. ✅ Agregar más operadores si es necesario

---

## 📞 Endpoints Útiles

**Búsqueda pública:**
```bash
GET /api/lookup/34607123456
GET /api/number-info/34607123456
GET /api/porting/34607123456
GET /api/spam-check/34607123456
```

**Admin (requiere token):**
```bash
POST /api/admin/login
GET /api/admin/stats
GET /api/admin/portings
POST /api/admin/porting/report
GET /api/admin/spam
POST /api/admin/spam/report
GET /api/admin/logs
```

---

**¡Sistema listo para usar! 🎉**
