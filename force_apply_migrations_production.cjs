require('dotenv/config');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// IMPORTANTE: Asegúrate de que DATABASE_URL apunta a PRODUCCIÓN
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function forceApplyMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(70));
    console.log('APLICANDO MIGRACIONES A BASE DE DATOS DE PRODUCCIÓN');
    console.log('='.repeat(70));
    console.log('');
    console.log('⚠️  ADVERTENCIA: Este script aplicará cambios a la base de datos');
    console.log('');
    
    // Mostrar información de la conexión (sin mostrar credenciales)
    const dbInfo = await client.query('SELECT current_database() as db, current_user as user');
    console.log(`📊 Base de datos: ${dbInfo.rows[0].db}`);
    console.log(`👤 Usuario: ${dbInfo.rows[0].user}`);
    console.log('');
    
    // Verificar estado ANTES
    console.log('📋 Verificando estado ANTES de las migraciones...');
    const beforeCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'photos' AND column_name IN ('image_data', 'mime_type')
    `);
    console.log(`   Columnas en photos: ${beforeCheck.rows.map(r => r.column_name).join(', ') || 'NINGUNA'}`);
    console.log('');
    
    if (beforeCheck.rows.length === 2) {
      console.log('✓ Las columnas YA EXISTEN. No es necesario aplicar migraciones.');
      console.log('');
      console.log('Si sigues viendo el error, puede ser:');
      console.log('  1. Problema de caché en la aplicación');
      console.log('  2. La app está conectada a otra base de datos');
      console.log('  3. Problema de permisos de usuario');
      console.log('');
      
      // Verificar permisos
      console.log('Verificando permisos...');
      try {
        await client.query('SELECT * FROM photos LIMIT 1');
        console.log('✓ Permisos de lectura: OK');
      } catch (err) {
        console.error('✗ Error de permisos:', err.message);
      }
      
      return;
    }
    
    console.log('⚠️  Las columnas NO EXISTEN. Aplicando migraciones...');
    console.log('');
    
    // Iniciar transacción
    console.log('🔄 Iniciando transacción...');
    await client.query('BEGIN');
    
    try {
      // Aplicar SOLO la migración crítica primero
      console.log('');
      console.log('📝 Aplicando migración 0022: Add image_data to photos');
      await client.query(`
        ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_data TEXT;
        ALTER TABLE photos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);
      `);
      console.log('   ✓ Columnas agregadas');
      
      // Verificar que se aplicó
      const afterCheck = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'photos' AND column_name IN ('image_data', 'mime_type')
        ORDER BY column_name
      `);
      
      console.log('');
      console.log('📊 Verificación de columnas agregadas:');
      afterCheck.rows.forEach(row => {
        console.log(`   ✓ ${row.column_name} (${row.data_type})`);
      });
      
      if (afterCheck.rows.length === 2) {
        // Commit si todo salió bien
        await client.query('COMMIT');
        console.log('');
        console.log('='.repeat(70));
        console.log('✅ MIGRACIONES APLICADAS EXITOSAMENTE');
        console.log('='.repeat(70));
        console.log('');
        console.log('Las columnas han sido agregadas a la tabla photos.');
        console.log('El error debería estar resuelto ahora.');
      } else {
        throw new Error('Las columnas no se agregaron correctamente');
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('');
      console.error('✗ Error durante la aplicación de migraciones');
      console.error('   Se ha hecho ROLLBACK de todos los cambios');
      throw error;
    }
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(70));
    console.error('❌ ERROR:');
    console.error('='.repeat(70));
    console.error(error);
    console.error('');
    console.error('Detalles del error:', error.message);
    console.error('');
    console.error('Posibles causas:');
    console.error('  1. DATABASE_URL no apunta a la base de datos correcta');
    console.error('  2. Permisos insuficientes del usuario de base de datos');
    console.error('  3. La base de datos no es accesible');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('');
console.log('⏳ Esperando 2 segundos antes de comenzar...');
console.log('   (Presiona Ctrl+C para cancelar)');
console.log('');

setTimeout(() => {
  forceApplyMigrations()
    .then(() => {
      console.log('');
      console.log('✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('');
      console.error('❌ Script terminado con errores');
      process.exit(1);
    });
}, 2000);

