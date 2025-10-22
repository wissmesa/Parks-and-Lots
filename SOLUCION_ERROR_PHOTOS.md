# Solución al Error de la Tabla Photos en Producción

## Problema

El error que estás experimentando se debe a que tu base de datos de producción no tiene aplicadas las migraciones desde la `0016` hasta la `0022`. Específicamente, la tabla `photos` no tiene las columnas `image_data` y `mime_type` que el código está intentando consultar.

**Error:**
```
Failed query: select "id", "entity_type", "entity_id", "url_or_path", "caption", "sort_order", "image_data", "mime_type" from "photos" order by "photos"."id" limit $1 params: 50
```

## Migraciones Faltantes

Las siguientes migraciones no han sido aplicadas en producción:

1. **0016_rename_user_roles.sql** - Renombra roles de usuario (ADMIN → MHP_LORD)
2. **0017_add_login_logs_table.sql** - Agrega tabla de logs de login
3. **0018_add_promotional_and_mobile_home_fields.sql** - Campos promocionales y de mobile home
4. **0019_add_deposit_and_down_payment_fields.sql** - Campos de depósito y pago inicial
5. **0020_make_lot_park_id_nullable.sql** - Hace park_id nullable
6. **0021_make_lot_price_nullable.sql** - Hace price nullable
7. **0022_add_image_data_to_photos.sql** - **Agrega image_data y mime_type a photos** ← ESTA ES LA CRÍTICA

## Solución

### Opción 1: Ejecutar el Script Automatizado (RECOMENDADO)

He creado un script que aplica todas las migraciones faltantes de forma segura:

```bash
# 1. Asegúrate de tener un backup de tu base de datos
# 2. Configura tu DATABASE_URL en el archivo .env apuntando a producción
# 3. Ejecuta el script:

node apply_missing_migrations.cjs
```

**Características del script:**
- ✅ Verifica el estado actual de la base de datos
- ✅ Usa transacciones (si algo falla, hace rollback)
- ✅ Da tiempo para cancelar (3 segundos)
- ✅ Verifica que todo se aplicó correctamente
- ✅ Muestra mensajes detallados de progreso

### Opción 2: Ejecutar SQL Manualmente

Si prefieres ejecutar el SQL directamente:

1. Abre el archivo `migrations/apply_missing_migrations_production.sql`
2. Conéctate a tu base de datos de producción
3. Ejecuta todo el contenido del archivo

**IMPORTANTE:** Este archivo contiene TODAS las migraciones faltantes en orden correcto.

### Opción 3: Solución Mínima (Solo el Error Actual)

Si solo quieres solucionar el error inmediato de la tabla photos:

```sql
-- Solo agregar las columnas faltantes a photos
ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_data TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);
```

⚠️ **ADVERTENCIA:** Esta solución parcial arreglará el error actual, pero seguirás teniendo otras migraciones pendientes que pueden causar problemas en el futuro.

## Verificación Post-Aplicación

Después de aplicar las migraciones, verifica que todo esté correcto:

```sql
-- Verificar columnas de photos
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'photos';

-- Debería mostrar:
-- id, entity_type, entity_id, url_or_path, caption, sort_order, image_data, mime_type

-- Verificar que la tabla login_logs existe
SELECT * FROM information_schema.tables WHERE table_name = 'login_logs';

-- Verificar nuevas columnas en lots
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'lots' 
AND column_name IN ('promotional_price', 'deposit_for_rent', 'mobile_home_year');
```

## Prevención Futura

Para evitar este problema en el futuro:

1. **Mantén sincronizado el journal de migraciones:** El archivo `migrations/meta/_journal.json` debe estar actualizado en producción
2. **Usa un sistema de deployment consistente:** Asegúrate de que las migraciones se ejecuten automáticamente en cada deploy
3. **Verifica antes de hacer push a producción:** Compara el journal de producción con el de desarrollo

## Contacto

Si tienes problemas aplicando estas migraciones, contacta al equipo de desarrollo antes de hacer cambios en producción.

---

**Creado:** 22 de Enero, 2025  
**Última actualización:** 22 de Enero, 2025

