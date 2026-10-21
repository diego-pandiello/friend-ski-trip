// Prueba la extracción del forfait sin pasar por la base de datos:
//   node --env-file=../../.env scripts/try-forfait.ts <url> <díasEsquí> <inicio> <fin>
import { extractForfait } from "../src/extract/forfait.ts";

const [url, skiDays = "4", startDate = "2027-02-04", endDate = "2027-02-09"] = process.argv.slice(2);
if (!url) {
  console.error("Uso: scripts/try-forfait.ts <url> [díasEsquí] [inicio] [fin]");
  process.exit(1);
}
console.log(await extractForfait({ url, skiDays: Number(skiDays), startDate, endDate }));
