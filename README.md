# PULSO — crono de partido

App para llevar el partido de futsal en directo desde un iPad: cronómetro,
minutos por jugador, cuartetos, goles, disparos, faltas y tarjetas. Funciona
**sin conexión** (los pabellones no siempre tienen cobertura) y guarda cada
partido en el propio aparato.

Al terminar genera el informe del partido en PDF y suma la temporada entera en
la pantalla de Totales, con copia de seguridad para cambiar de iPad.

## Los cuatro clientes

El mismo código sirve a varios equipos. Lo único que cambia es la variable
`NEXT_PUBLIC_CLIENTE`, que decide la plantilla, la contraseña, la marca y el
nombre de la base local:

| Cliente | Dónde se publica | Qué es |
|---|---|---|
| `inter` | `/pulso/crono/` | Primer equipo del Inter JP Financial |
| `filial` | `/pulso/crono-filial/` | Filial (plantilla y contraseña propias) |
| `juvenil` | `/pulso/crono-juvenil/` | Juvenil División de Honor (plantilla y contraseña propias) |
| `pulso` | `/pulso/crono-demo/` | Demo con datos inventados, para enseñar |

Cada cliente tiene **su propia base de datos** en el navegador, así que dos
equipos en el mismo iPad no se mezclan ni ven los partidos del otro.

> Antes de mayo… ⚠️ **El crono del Inter no se toca el día antes de un partido.**

## Plantillas privadas

Desde el 24/11/2026 **la plantilla real del Inter, del filial y del juvenil no
está en el código**: este repositorio es público y aquí solo hay datos
inventados (la demo, en `src/lib/roster.ts`, y unas plantillas de ejemplo en
`roster-privado.ejemplo/`). La real se le da al build desde fuera y
`next.config.ts` la mete en el paquete **de ese club y solo de ese club**
(detalle en `cargarRoster.mjs`):

| Dónde | Qué |
|---|---|
| GitHub Actions | Secretos del repositorio `ROSTER_INTER`, `ROSTER_FILIAL`, `ROSTER_JUVENIL` (y, para cifrarla, `CRONO_CLAVE_INTER`, `CRONO_CLAVE_FILIAL`, `CRONO_CLAVE_JUVENIL`) |
| Este ordenador | `~/Desktop/Claude/pulso_secretos/roster_<cliente>.json` (fuera del repo; vale para todas las copias de trabajo) o `roster-privado/<cliente>.json` (dentro, ignorado por git) |

El contenido es el JSON de `roster-privado.ejemplo/inter.json`:
`{"cliente": "inter", "jugadores": [{"dorsal": "1", "nombre": "…", "posicion": "PORTERO", "equipo": "PRIMER"}, …]}`.
Los nombres son los canónicos del club (los que lee el importador): no se
cambian por motes.

- **Sin plantilla, el build del Inter, el filial o el juvenil FALLA** con un
  mensaje que dice dónde ponerla. Nunca se publica un crono de un club con
  nombres inventados. La demo (`npm run demo`) no necesita nada.
- **Desde el 25/11/2026 la web publicada la lleva CIFRADA** (revisión legal
  del 24/11, RGPD art. 25.2; detalle en `cifrarPlantilla.mjs` y
  `src/lib/plantillaCifrada.ts`): PBKDF2-SHA256 (600.000 iteraciones, sal
  aleatoria por build) + AES-256-GCM con la **contraseña de entrada al crono**
  de ese club. En los ficheros publicados no queda ningún nombre ni ningún hash
  de esa contraseña. El aparato la abre al entrar y la guarda abierta en su
  almacenamiento local: después funciona sin red y sin volver a pedirla.
  - El build necesita la contraseña en claro: secretos
    `CRONO_CLAVE_INTER`, `CRONO_CLAVE_FILIAL`, `CRONO_CLAVE_JUVENIL` (Actions)
    o `~/Desktop/Claude/pulso_secretos/clave_<cliente>.txt` (una línea). Se
    comprueba contra `VERIFICADORES` de `cifrarPlantilla.mjs`; sin ella o con
    una errata, ese build falla.
  - **Cambiar la contraseña de un club**: nueva en `clave_<cliente>.txt` →
    `node scripts/clave_club.mjs <cliente>` → pegar el verificador en
    `cifrarPlantilla.mjs` → `gh secret set CRONO_CLAVE_<CLUB> <
    ~/Desktop/Claude/pulso_secretos/clave_<cliente>.txt` → publicar. Los
    aparatos ya dentro no la piden (la plantilla guardada sigue valiendo).
  - Aparato que ya estaba dentro con una versión anterior: la primera vez pide
    la contraseña UNA vez; si hay un partido a medias, se puede seguir sin ella
    con los convocados de ese partido. Alta o baja de un jugador: el aparato
    sigue con la plantilla de antes y avisa en el inicio para cargar la nueva.
  - Ficheros viejos con la plantilla en claro que quedan en `gh-pages`
    (`keep_files`): `scripts/limpiar_gh_pages.mjs`, después de publicar.
- **Alta o baja de un jugador**: se cambia el JSON en
  `~/Desktop/Claude/pulso_secretos/`, se sube al secreto
  (`gh secret set ROSTER_INTER < ~/Desktop/Claude/pulso_secretos/roster_inter.json`)
  y se vuelve a publicar (Actions → «Deploy crono a GitHub Pages» → *Run
  workflow*). Cambiar un secreto no publica nada por sí solo.
- `src/lib/sinNombresReales.test.ts` falla si un nombre de la plantilla real
  vuelve a aparecer en cualquier fichero del repo. Corre en cada despliegue y
  conviene pasarlo antes de cada commit.

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
construye los cuatro clientes **uno detrás de otro** y los sube a la rama
`gh-pages`. En serie a propósito — en paralelo se pisaban el push y un cliente
se quedaba atrás en silencio.

El `sw.js` se sella con el SHA del commit en cada despliegue. Sin eso el
fichero sería idéntico byte a byte, el navegador no instalaría el service
worker nuevo y el iPad podría seguir con una versión de hace semanas.

La versión desplegada se ve **junto al título** en la pantalla de inicio.

## Antes de escribir código

Lee `AGENTS.md`: esta versión de Next.js no es la que te sabes.
