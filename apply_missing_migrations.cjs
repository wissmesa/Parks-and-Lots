require('dotenv/config');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function applyMissingMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(60));
    console.log('APLICANDO MIGRACIONES FALTANTES EN PRODUCCIÓN');
    console.log('Migraciones: 0016 a 0022');
    console.log('='.repeat(60));
    console.log('');
    
    // Verificar si las columnas ya existen
    console.log('Verificando estado actual de la base de datos...');
    const checkPhotos = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'photos' AND column_name IN ('image_data', 'mime_type')
    `);
    
    if (checkPhotos.rows.length === 2) {
      console.log('✓ Las columnas image_data y mime_type ya existen en la tabla photos');
      console.log('Las migraciones parecen estar aplicadas. Saliendo...');
      return;
    }
    
    console.log('⚠ Faltan columnas en la tabla photos. Aplicando migraciones...');
    console.log('');
    
    // Leer el archivo SQL consolidado
    const sqlFile = path.join(__dirname, 'migrations', 'apply_missing_migrations_production.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Dividir por migraciones para mejor logging
    const migrations = [
      { name: 'MIGRACIÓN 0016: Rename user roles', marker: '-- MIGRACIÓN 0016' },
      { name: 'MIGRACIÓN 0017: Add login_logs table', marker: '-- MIGRACIÓN 0017' },
      { name: 'MIGRACIÓN 0018: Add promotional and mobile home fields', marker: '-- MIGRACIÓN 0018' },
      { name: 'MIGRACIÓN 0019: Add deposit and down payment fields', marker: '-- MIGRACIÓN 0019' },
      { name: 'MIGRACIÓN 0020: Make lot park_id nullable', marker: '-- MIGRACIÓN 0020' },
      { name: 'MIGRACIÓN 0021: Make lot price nullable', marker: '-- MIGRACIÓN 0021' },
      { name: 'MIGRACIÓN 0022: Add image_data to photos', marker: '-- MIGRACIÓN 0022' }
    ];
    
    console.log('Iniciando transacción...');
    await client.query('BEGIN');
    
    try {
      // Ejecutar todo el contenido SQL
      console.log('Ejecutando todas las migraciones...');
      await client.query(sqlContent);
      
      console.log('');
      console.log('✓ Todas las migraciones ejecutadas exitosamente');
      console.log('');
      
      // Verificar resultados
      console.log('Verificando resultados...');
      
      // Verificar photos
      const photosCheck = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'photos' AND column_name IN ('image_data', 'mime_type')
        ORDER BY column_name
      `);
      console.log('✓ Columnas en tabla photos:');
      photosCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      
      // Verificar login_logs
      const loginLogsCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'login_logs'
        ) as exists
      `);
      console.log(`✓ Tabla login_logs: ${loginLogsCheck.rows[0].exists ? 'EXISTE' : 'NO EXISTE'}`);
      
      // Verificar columnas de lots
      const lotsCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'lots' 
        AND column_name IN ('promotional_price', 'deposit_for_rent', 'image_data')
        ORDER BY column_name
      `);
      console.log(`✓ Nuevas columnas en tabla lots: ${lotsCheck.rows.length} columnas agregadas`);
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('');
      console.log('='.repeat(60));
      console.log('✓ MIGRACIONES APLICADAS EXITOSAMENTE');
      console.log('='.repeat(60));
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('');
      console.error('✗ Error durante la aplicación de migraciones');
      console.error('Se ha hecho ROLLBACK de todos los cambios');
      throw error;
    }
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(60));
    console.error('✗ ERROR EN LA MIGRACIÓN:');
    console.error('='.repeat(60));
    console.error(error);
    console.error('');
    console.error('IMPORTANTE: Verifica el estado de tu base de datos');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar con confirmación
console.log('');
console.log('ADVERTENCIA: Este script aplicará migraciones a tu base de datos de producción.');
console.log('Asegúrate de tener un backup antes de continuar.');
console.log('');
console.log('Presiona Ctrl+C para cancelar, o espera 3 segundos para continuar...');
console.log('');

setTimeout(() => {
  applyMissingMigrations().catch(error => {
    console.error('Script terminado con errores');
    process.exit(1);
  });
}, 3000);

