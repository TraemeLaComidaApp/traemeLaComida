-- Datos de prueba para Traeme la comida

-- 1. Tablas Base (Sin dependencias)
INSERT INTO public.configuracion_local (nombre_local, logo_url, color_primario, link_resenas_google)
VALUES ('El Rincón del Sabor', 'https://example.com/logo.png', '#FF5733', 'https://g.page/r/example');

INSERT INTO public.usuario (usuario, password, email, rol)
VALUES 
('admin', 'admin123', 'admin@elrincon.com', 'propietario'),
('cocinero1', 'cocina123', 'cocina@elrincon.com', 'cocina'),
('camarero1', 'camarero123', 'camarero@elrincon.com', 'camarero');

INSERT INTO public.sala (nombre, ancho, alto)
VALUES 
('Terraza', 10, 8),
('Salón Principal', 15, 12);

INSERT INTO public.categoria_producto (nombre, orden)
VALUES 
('Entrantes', 1),
('Bebidas', 2),
('Platos Principales', 3),
('Postres', 4);

INSERT INTO public.categoria_opcion (nombre)
VALUES 
('Puntos de carne'),
('Extras Pizza'),
('Tamaños Bebida');

-- 2. Tablas de Segundo Nivel
INSERT INTO public.mesa (id_sala, tipo, numero, uuid, pos_x, pos_y, ancho, alto)
VALUES 
(1, 'mesa', 'T1', 'qr_t1', 1, 1, 2, 2),
(1, 'mesa', 'T2', 'qr_t2', 4, 1, 2, 2),
(2, 'mesa', 'S1', 'qr_s1', 2, 2, 2, 2),
(2, 'barra', 'B1', 'qr_b1', 10, 10, 1, 1);

INSERT INTO public.producto (id_categoria_producto, nombre, descripcion, precio, imagen_url, disponible, orden)
VALUES 
(1, 'Bravas', 'Patatas bravas caseras', 5.50, 'https://example.com/bravas.jpg', true, 1),
(2, 'Cerveza', 'Caña de cerveza', 2.50, 'https://example.com/cerveza.jpg', true, 1),
(3, 'Solomillo', 'Solomillo de ternera', 18.00, 'https://example.com/solomillo.jpg', true, 1),
(4, 'Tarta de Queso', 'Tarta casera', 6.00, 'https://example.com/tarta.jpg', true, 1);

INSERT INTO public.opcion (id_categoria_opcion, nombre, precio_extra)
VALUES 
(1, 'Poco hecho', 0.00),
(1, 'Al punto', 0.00),
(1, 'Muy hecho', 0.00),
(3, 'Grande', 1.00);

-- 3. Relaciones Muchos a Muchos / Configuraciones
INSERT INTO public.producto_categoria_opcion (id_producto, id_categoria_opcion, min_selecciones, max_selecciones, orden)
VALUES 
(3, 1, 1, 1, 1), -- Solomillo -> Puntos de carne
(2, 3, 0, 1, 1); -- Cerveza -> Tamaños Bebida

-- 4. Tablas Transaccionales
INSERT INTO public.pedido (id_mesa, es_barra, estado, creado_at, fecha_final)
VALUES 
(1, false, 'recibido', now(), NULL),
(3, false, 'listo', now() - interval '45 minutes', NULL);

-- 5. Pedidos y Detalles

INSERT INTO public.detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, estado, notas)
VALUES 
(1, 1, 1, 5.50, 'no_servido', 'Sin picante'),
(1, 2, 2, 2.50, 'no_servido', NULL),
(2, 3, 1, 18.00, 'listo', 'Muy hecho'),
(2, 4, 1, 6.00, 'servido', NULL);

-- 6. Selecciones y Pagos
INSERT INTO public.seleccion_opcion (id_opcion, id_detalle_pedido, precio_extra_aplicado)
VALUES 
(4, 2, 1.00), -- Cerveza Grande (id_detalle_pedido=2)
(3, 3, 0.00); -- Solomillo Muy hecho (id_detalle_pedido=3)

INSERT INTO public.pago (id_pedido, monto_pagado, metodo, fecha_pago)
VALUES 
(2, 25.00, 'Tarjeta', now() - interval '10 minutes');
