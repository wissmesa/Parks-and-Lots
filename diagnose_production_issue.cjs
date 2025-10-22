require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function diagnoseProblem() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(70));
    console.log('DIAGNÓSTICO DEL PROBLEMA DE PHOTOS EN PRODUCCIÓN');
    console.log('='.repeat(70));
    console.log('');
    
    // 1. Info de conexión
    const dbInfo = await client.query(`
      SELECT 
        current_database() as database,
        current_user as user,
        inet_server_addr() as server_ip,
        version() as version
    `);
    console.log('1️⃣  INFORMACIÓN DE CONEXIÓN:');
    console.log(`   Base de datos: ${dbInfo.rows[0].database}`);
    console.log(`   Usuario: ${dbInfo.rows[0].user}`);
    console.log(`   Servidor: ${dbInfo.rows[0].server_ip || 'N/A'}`);
    console.log('');
    
    // 2. Verificar tabla photos
    console.log('2️⃣  ESTRUCTURA DE LA TABLA PHOTOS:');
    const columns = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'photos' 
      ORDER BY ordinal_position
    `);
    
    if (columns.rows.length === 0) {
      console.log('   ❌ LA TABLA PHOTOS NO EXISTE!');
      return;
    }
    
    console.log('   Columnas encontradas:');
    columns.rows.forEach(col => {
      const indicator = ['image_data', 'mime_type'].includes(col.column_name) ? '✓' : ' ';
      console.log(`   ${indicator} ${col.column_name.padEnd(20)} (${col.data_type})`);
    });
    console.log('');
    
    // 3. Verificar columnas críticas
    const hasImageData = columns.rows.some(c => c.column_name === 'image_data');
    const hasMimeType = columns.rows.some(c => c.column_name === 'mime_type');
    
    console.log('3️⃣  VERIFICACIÓN DE COLUMNAS CRÍTICAS:');
    console.log(`   image_data: ${hasImageData ? '✅ EXISTE' : '❌ NO EXISTE'}`);
    console.log(`   mime_type:  ${hasMimeType ? '✅ EXISTE' : '❌ NO EXISTE'}`);
    console.log('');
    
    // 4. Intentar la query exacta que está fallando
    console.log('4️⃣  PROBANDO LA QUERY QUE ESTÁ FALLANDO:');
    try {
      const testQuery = await client.query(`
        SELECT 
          "id",
          "entity_type",
          "entity_id",
          "url_or_path",
          "caption",
          "sort_order",
          "image_data",
          "mime_type"
        FROM "photos"
        ORDER BY "photos"."id"
        LIMIT 50
      `);
      console.log(`   ✅ Query ejecutada exitosamente (${testQuery.rows.length} registros)`);
    } catch (queryError) {
      console.log('   ❌ QUERY FALLÓ:');
      console.log(`   Error: ${queryError.message}`);
      console.log('');
      console.log('   Código de error:', queryError.code);
      console.log('   Detalle:', queryError.detail || 'N/A');
    }
    console.log('');
    
    // 5. Verificar datos de ejemplo
    console.log('5️⃣  DATOS DE EJEMPLO:');
    const sampleCount = await client.query('SELECT COUNT(*) as total FROM photos');
    console.log(`   Total de registros: ${sampleCount.rows[0].total}`);
    
    if (parseInt(sampleCount.rows[0].total) > 0) {
      const sample = await client.query('SELECT * FROM photos LIMIT 1');
      const record = sample.rows[0];
      console.log('   Ejemplo de registro:');
      console.log(`   - ID: ${record.id}`);
      console.log(`   - Entity Type: ${record.entity_type}`);
      console.log(`   - Has image_data: ${record.image_data ? 'Sí' : 'No'}`);
      console.log(`   - Mime type: ${record.mime_type || 'N/A'}`);
    }
    console.log('');
    
    // 6. Diagnóstico y recomendaciones
    console.log('='.repeat(70));
    console.log('📊 DIAGNÓSTICO:');
    console.log('='.repeat(70));
    
    if (hasImageData && hasMimeType) {
      console.log('✅ La base de datos está CORRECTAMENTE configurada.');
      console.log('');
      console.log('Si sigues viendo el error, el problema está en:');
      console.log('');
      console.log('🔧 SOLUCIONES:');
      console.log('');
      console.log('1. REINICIAR LA APLICACIÓN:');
      console.log('   - El servidor Node.js debe reiniciarse para recargar el esquema');
      console.log('   - Si usas PM2: pm2 restart all');
      console.log('   - Si usas Replit: Detener y reiniciar el proceso');
      console.log('');
      console.log('2. LIMPIAR CACHÉ DE DRIZZLE:');
      console.log('   - Eliminar node_modules/.cache si existe');
      console.log('   - npm run drizzle-kit push (si usas Drizzle Kit)');
      console.log('');
      console.log('3. VERIFICAR VARIABLE DE ENTORNO:');
      console.log('   - Asegúrate de que DATABASE_URL en producción sea correcta');
      console.log('   - Verifica que no haya múltiples instancias con diferentes URLs');
      console.log('');
      console.log('4. SI USAS DRIZZLE STUDIO:');
      console.log('   - Cierra y vuelve a abrir Drizzle Studio');
      console.log('   - El error puede venir de ahí, no de tu aplicación');
      console.log('');
    } else {
      console.log('❌ FALTAN COLUMNAS EN LA BASE DE DATOS');
      console.log('');
      console.log('Ejecuta este comando SQL en tu base de datos:');
      console.log('');
      console.log('ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_data TEXT;');
      console.log('ALTER TABLE photos ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);');
      console.log('');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Error durante el diagnóstico:');
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnoseProblem().catch(console.error);

