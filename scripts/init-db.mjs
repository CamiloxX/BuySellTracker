import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { initSchema } from "../lib/db.js";

initSchema()
  .then(() => {
    console.log("✅ Schema ready");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
