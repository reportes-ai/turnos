# 📋 Instrucciones para Actualizar GitHub

## Versión Restaurada a Funcionamiento

Tu aplicación vuelve a su versión **estable y funcional**. 

### Archivos Finales (MANTENER):
- ✅ `index.html` - Interfaz principal
- ✅ `styles.css` - Estilos tema oscuro
- ✅ `storage.js` - Almacenamiento localStorage
- ✅ `scheduler.js` - Lógica básica turnos
- ✅ `app.js` - Controlador principal
- ✅ `README.md` - Documentación

### Archivos a Eliminar en GitHub:
- ❌ `app-complete.js`
- ❌ `scheduler-v2.js`
- ❌ `gesturnost.html`
- ❌ `GITHUB_VERCEL_GUIDE.md` (opcional)
- ❌ `TUTORIAL_SIN_TECNICISMOS.md` (opcional)
- ❌ `TUTORIAL_MINUTO_A_MINUTO.md` (opcional)

---

## Pasos por Terminal

```bash
# 1. Entra a tu carpeta local
cd tu-ruta/gesturnost-turnos

# 2. Elimina archivos viejos
rm app-complete.js scheduler-v2.js gesturnost.html 2>/dev/null || true

# 3. Verifica que tienes estos 5 archivos:
ls -1
# Esperado:
# index.html
# styles.css
# app.js
# storage.js
# scheduler.js
# README.md

# 4. Sube a GitHub
git add -A
git commit -m "Restaurar a versión estable y funcional"
git push
```

---

## Próximos Pasos

Ahora vamos a **mejorar el algoritmo de optimización de turnos** sin tocar la interfaz:

1. ✅ La app está funcionando
2. ✅ Puedes crear empresas y trabajadores
3. ⏭️ Ahora mejoraremos la lógica de generación de turnos en `scheduler.js`

---

## URL en Vercel
```
https://turnos-blue.vercel.app
```

Vercel se actualiza automáticamente cuando hagas `git push`.

