# PULSO — crono de partido

App para llevar el partido de futsal en directo desde un iPad: cronómetro,
minutos por jugador, cuartetos, goles, disparos, faltas y tarjetas. Funciona
**sin conexión** (los pabellones no siempre tienen cobertura) y guarda cada
partido en el propio aparato.

Al terminar genera el informe del partido en PDF y suma la temporada entera en
la pantalla de Totales, con copia de seguridad para cambiar de iPad.

## Los tres clientes

El mismo código sirve a varios equipos. Lo único que cambia es la variable
`NEXT_PUBLIC_CLIENTE`, que decide la plantilla, la contraseña, la marca y el
nombre de la base local:

| Cliente | Dónde se publica | Qué es |
|---|---|---|
| `inter` | `/pulso/crono/` | Primer equipo del Inter JP Financial |
| `filial` | `/pulso/crono-filial/` | Filial (plantilla y contraseña propias) |
| `pulso` | `/pulso/crono-demo/` | Demo con datos inventados, para enseñar |

Cada cliente tiene **su propia base de datos** en el navegador, así que dos
equipos en el mismo iPad no se mezclan ni ven los partidos del otro.

> Antes de mayo… ⚠️ **El crono del Inter no se toca el día antes de un partido.**

## Trabajar en local

```bash
npm install
npm run dev
```

En `localhost` no se registra el service worker, así que los cambios se ven al
recargar sin peleas de caché.

Para reproducir un build igual que el de producción:

```bash
NEXT_EXPORT=1 NEXT_PUBLIC_CLIENTE=inter \
  CRONO_BASEPATH=/pulso/crono NEXT_PUBLIC_BASEPATH=/pulso/crono \
  npm run build
```

## Publicar

Se publica solo: cada push a `main` lanza `.github/workflows/deploy.yml`, que
construye los tres clientes **uno detrás de otro** y los sube a la rama
`gh-pages`. En serie a propósito — en paralelo se pisaban el push y un cliente
se quedaba atrás en silencio.

El `sw.js` se sella con el SHA del commit en cada despliegue. Sin eso el
fichero sería idéntico byte a byte, el navegador no instalaría el service
worker nuevo y el iPad podría seguir con una versión de hace semanas.

La versión desplegada se ve **junto al título** en la pantalla de inicio.

## Antes de escribir código

Lee `AGENTS.md`: esta versión de Next.js no es la que te sabes.
