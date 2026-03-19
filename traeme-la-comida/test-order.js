import { submitOrder } from './src/services/apiCliente.js';
import { supabase } from './src/services/supabaseClient.js';

async function testOrder() {
    console.log("Iniciando test de submitOrder...");
    
    // Obtenemos un producto cualquiera disponible para simular
    const { data: productos } = await supabase.from('producto').select('*').limit(1);
    
    if (!productos || productos.length === 0) {
        console.error("No hay productos en la base de datos.");
        process.exit(1);
    }
    
    const prod = productos[0];
    
    const carritoTest = [
        {
            producto: { id: prod.id, nombre: prod.nombre, precio: prod.precio },
            nombre: prod.nombre,
            precioFinal: prod.precio,
            extrasAplicados: [],
            notaPersonal: "Test automatizado CLI",
            nota: "Test automatizado CLI"
        }
    ];
    
    try {
        // Para simular cliente, pasamos mesa=1, es_barra=false
        await submitOrder(1, false, null, carritoTest);
        console.log("✅ Pedido enviado correctamente a Supabase.");
    } catch(err) {
        console.error("❌ Error al enviar el pedido:", err);
    }
    
    process.exit(0);
}

testOrder();
