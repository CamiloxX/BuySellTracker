import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { runScrape } from "../lib/runScrape.js";

runScrape()
  .then((r) => {
    console.log(`✅ Done. products=${r.snapshot.length} competitors=${r.competitors.length} alerts=${r.alerts.length}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
