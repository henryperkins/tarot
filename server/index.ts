import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

app.set("trust proxy", 1);

async function startServer() {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const distPath = path.resolve(__dirname, "../dist");
  app.use(express.static(distPath));

  app.use((req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(distPath, "index.html"));
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  const PORT = parseInt(process.env.PORT || "5000", 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
