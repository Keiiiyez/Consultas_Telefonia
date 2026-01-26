# 🛰️ Configuración Vonage - Plan Gratis

## ¿Qué es Vonage Number Insight?

Vonage (anteriormente Nexmo) proporciona una API **completamente GRATIS** para verificar números telefónicos. Puedes hacer búsquedas ilimitadas sin pagar nada.

**Plan Gratis (Basic Lookup):**
- ✅ Información del operador
- ✅ Tipo de línea (móvil, fija, etc.)
- ✅ Detecta portabilidades aproximadas
- ✅ Validación de número
- ✅ **COMPLETAMENTE GRATIS**
- ❌ Sin límites de consultas

## 📋 Pasos para configurar

### 1. Crear cuenta Vonage

1. Ve a: https://dashboard.nexmo.com/
2. Haz clic en "Create account"
3. Completa tu email y contraseña
4. Verifica tu email
5. Completa tu perfil (nombre, país, etc.)

### 2. Obtener API Keys

1. Inicia sesión en https://dashboard.nexmo.com/
2. En la izquierda, ve a **Settings → API keys**
3. Verás:
   - `API Key` (clave pública)
   - `API Secret` (clave secreta)

### 3. Configurar en tu proyecto

1. Abre tu archivo `.env`
2. Agrega las claves:

```env
VONAGE_API_KEY=tu_api_key_aqui
VONAGE_API_SECRET=tu_api_secret_aqui
```

**Ejemplo real (no uses estos valores!):**
```env
VONAGE_API_KEY=3f9e2c5b8a1d4e6f
VONAGE_API_SECRET=9x2w5v8u1t4r7q0p
```

### 4. Reinicia tu servidor

```bash
npm start
```

## ✅ Prueba que funciona

### Desde el terminal:

```bash
curl "http://localhost:3000/api/vonage/verify/34600123456"
```

Deberías recibir:
```json
{
  "success": true,
  "internationalFormat": "+34 600 123 456",
  "carrierName": "Movistar",
  "numberType": "mobile",
  "countryCode": "ES",
  "countryName": "Spain"
}
```

### Desde el Admin Panel

1. Ve a http://localhost:3000/admin.html
2. Haz clic en "Verificar Vonage" en el menú
3. Ingresa un número español (34XXXXXXXXX)
4. Haz clic en "Verificar con Vonage"

## 🎯 Usos en tu aplicación

### Opción 1: Verificar un número

**Frontend:**
```javascript
fetch('/api/vonage/verify/34600123456')
  .then(r => r.json())
  .then(data => console.log(data.carrierName));
```

### Opción 2: Comparar con tu BD

```javascript
fetch('/api/vonage/compare/34600123456/Movistar')
  .then(r => r.json())
  .then(data => {
    if (data.match) {
      console.log('✅ Operador coincide');
    } else {
      console.log('⚠️ Posible portabilidad:', data.recommendation);
    }
  });
```

## 💡 Casos de uso

### Caso 1: Detectar portabilidades automáticamente
```
Usuario busca: 34600123456 (Movistar en tu BD)
Vonage dice: Vodafone
Sistema: ⚠️ "Posible portabilidad - actualizar"
```

### Caso 2: Verificar números nuevos
```
Admin carga CSV
Sistema verifica cada número con Vonage
Guarda datos confiables desde el inicio
```

### Caso 3: Validar números en tiempo real
```
Usuario ingresa: 34600123456
Vonage valida inmediatamente
Devuelve resultado + recomendaciones
```

## ⚙️ Endpoints disponibles

```bash
# Verificar (gratis)
GET /api/vonage/verify/:number

# Comparar con BD
GET /api/vonage/compare/:number/:dbOperator
```

## 🔒 Seguridad

- ✅ Las claves se cargan desde `.env` (no en código)
- ✅ No expongas `VONAGE_API_SECRET` en público
- ✅ El plan gratis no tiene tarjeta de crédito
- ✅ No hay cargos automáticos

## ❓ Preguntas frecuentes

**P: ¿Cuántas consultas puedo hacer?**
R: Ilimitadas con el plan gratis.

**P: ¿Qué información puedo obtener?**
R: Operador, tipo de línea, país, validación de número.

**P: ¿Necesito tarjeta de crédito?**
R: No, el plan basic es completamente gratis.

**P: ¿Qué pasa si supero el límite?**
R: No hay límite en el plan gratis.

**P: ¿Puedo usar números de otros países?**
R: Sí, Vonage funciona globalmente.

## 🐛 Troubleshooting

**Error: "Vonage no configurado"**
- Verifica que `VONAGE_API_KEY` y `VONAGE_API_SECRET` estén en `.env`
- Reinicia el servidor

**Error: "Unknown column"**
- Reinicia el servidor después de cambiar `.env`

**La API rechaza mi número**
- Verifica el formato: debe ser `34XXXXXXXXX` (34 + 9 dígitos)

**Respuesta: "Unknown carrier"**
- Vonage no conoce este número
- Puede ser número privado o no asignado

## 📚 Recursos

- Documentación oficial: https://developer.vonage.com/number-insight/overview
- Codes de estado: https://developer.vonage.com/en/api/number-insight

## 🚀 Próximos pasos

Una vez configurado, puedes:

1. ✅ Verificar números en el admin panel
2. ✅ Comparar BD con Vonage automáticamente
3. ✅ Agregar botón "Verificar" en búsquedas públicas
4. ✅ Detectar portabilidades en tiempo real
5. ✅ Mantener datos actualizados

---

**¿Necesitas ayuda?** Verifica que tu cuenta Vonage esté activa en https://dashboard.nexmo.com/

