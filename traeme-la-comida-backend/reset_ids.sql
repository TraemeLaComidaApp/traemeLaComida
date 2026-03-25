-- Query to reset all data and restart identity sequences for all tables
-- WARNING: This will DELETE all records from your database!

TRUNCATE TABLE 
    public.pago,
    public.seleccion_opcion,
    public.detalle_pedido,
    public.pedido,
    public.opcion,
    public.producto_categoria_opcion,
    public.categoria_opcion,
    public.producto,
    public.categoria_producto,
    public.mesa,
    public.sala,
    public.configuracion_local,
    public.usuario
RESTART IDENTITY CASCADE;
