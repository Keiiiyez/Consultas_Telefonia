/**
 * FLUJO DE ACCESO ADMIN
 * 
 * USUARIO NO LOGUEADO:
 * ├─ Entra a http://localhost:3000
 * ├─ Ve el index.html con la opción "Acceder al Admin"
 * ├─ Puede hacer clic en:
 * │  ├─ Botón "Acceder al Admin" (header o CTA)
 * │  └─ "Más Información" (abre modal con info del admin)
 * ├─ Redirige a /admin-login.html
 * ├─ Ingresa contraseña (default: admin123)
 * ├─ Sistema valida contraseña en backend
 * ├─ Si es correcta:
 * │  ├─ Genera JWT token
 * │  ├─ Guarda en localStorage
 * │  ├─ Redirige a /admin.html (después de 1.5s)
 * └─ Si es incorrecta:
 *    └─ Muestra error
 * 
 * EN ADMIN.HTML:
 * ├─ Verifica si hay token en localStorage
 * ├─ Si NO hay token → redirige a login
 * ├─ Si hay token:
 * │  ├─ Valida token con /api/admin/verify
 * │  ├─ Si token válido → carga dashboard
 * │  └─ Si token inválido → borra y redirige a login
 * 
 * EN LOGOUT:
 * ├─ Elimina token del localStorage
 * ├─ Elimina rememberAdmin
 * └─ Redirige a /admin-login.html
 * 
 * USUARIO YA LOGUEADO:
 * ├─ Si ingresa a /admin-login.html directamente
 * ├─ detecta que ya tiene token válido
 * └─ Redirige automáticamente a /admin.html
 * 
 * SEGURIDAD:
 * ├─ Todos los requests al admin llevan Authorization header con JWT
 * ├─ Token expira en 24 horas
 * ├─ Password está en variables de entorno (.env)
 * ├─ Rate limiting en API pública (100 req/15 min por IP)
 * └─ Todos los endpoints admin requieren autenticación válida
 */

// ENDPOINTS:
/*
 * LOGIN:
 *   POST /api/admin/login
 *   Body: { password: "string" }
 *   Response: { token: "JWT", message: "Autenticación exitosa" }
 * 
 * VERIFY TOKEN:
 *   GET /api/admin/verify
 *   Headers: Authorization: Bearer <token>
 *   Response: { valid: true, admin: {...} }
 * 
 * STATS (ADMIN):
 *   GET /api/admin/stats
 *   Headers: Authorization: Bearer <token>
 *   Response: { total, successful, failed, avg_time, by_operator, top_numbers }
 * 
 * OTROS ENDPOINTS ADMIN:
 *   - GET /api/admin/portings
 *   - POST /api/admin/porting/report
 *   - GET /api/admin/spam
 *   - POST /api/admin/spam/report
 *   - GET /api/admin/logs
 * 
 * TODOS REQUIEREN: Authorization: Bearer <token>
 */
