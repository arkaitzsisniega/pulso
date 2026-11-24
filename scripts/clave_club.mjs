/**
 * Verificador de la contraseña de un club (25/11/2026) — para cuando se
 * CAMBIA la contraseña del Inter, del filial o del juvenil.
 *
 *   node scripts/clave_club.mjs inter                  # la lee de pulso_secretos/clave_inter.txt
 *   printf %s "LA NUEVA" | node scripts/clave_club.mjs inter --stdin
 *
 * Imprime el verificador (PBKDF2, NO la contraseña) para pegarlo en
 * VERIFICADORES de cifrarPlantilla.mjs. Después: la contraseña nueva en el
 * secreto CRONO_CLAVE_<CLUB> (gh secret set CRONO_CLAVE_INTER <
 * ~/Desktop/Claude/pulso_secretos/clave_inter.txt) y publicar.
 * La contraseña nunca se imprime.
 */
import { readFileSync } from "node:fs";
import { buscarClave, verificador } from "../cifrarPlantilla.mjs";
import { CLIENTES_PRIVADOS } from "../cargarRoster.mjs";

const [cliente, modo] = process.argv.slice(2);
if (!CLIENTES_PRIVADOS.includes(cliente)) {
  console.error(`Uso: node scripts/clave_club.mjs <${CLIENTES_PRIVADOS.join("|")}> [--stdin]`);
  process.exit(2);
}
let clave;
if (modo === "--stdin") clave = readFileSync(0, "utf8").replace(/\r?\n$/, "");
else clave = buscarClave(cliente)?.clave;
if (!clave) {
  console.error(`No encuentro la contraseña de «${cliente}» (ni --stdin ni clave_${cliente}.txt).`);
  process.exit(1);
}
console.log(`  ${cliente}: "${verificador(clave, cliente)}",`);
