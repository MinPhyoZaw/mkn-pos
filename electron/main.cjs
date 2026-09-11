const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

const isDev = !app.isPackaged;

let mainWindow = null;
let localServer = null;

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  return types[ext] || "application/octet-stream";
}

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const outDir = path.join(__dirname, "../out");

    localServer = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(
          (req.url || "/").split("?")[0]
        );

        if (urlPath === "/") {
          urlPath = "/dashboard/";
        }

        let filePath = path.join(outDir, urlPath);

        // Protect against paths outside out/
        const normalizedOut = path.resolve(outDir);
        const normalizedFile = path.resolve(filePath);

        if (!normalizedFile.startsWith(normalizedOut)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        // /products/ -> /products/index.html
        if (
          urlPath.endsWith("/") ||
          (fs.existsSync(filePath) &&
            fs.statSync(filePath).isDirectory())
        ) {
          filePath = path.join(filePath, "index.html");
        }

        // /products -> /products/index.html
        if (!fs.existsSync(filePath)) {
          const routeIndex = path.join(
            outDir,
            urlPath,
            "index.html"
          );

          if (fs.existsSync(routeIndex)) {
            filePath = routeIndex;
          }
        }

        if (!fs.existsSync(filePath)) {
          res.writeHead(404, {
            "Content-Type": "text/plain; charset=utf-8",
          });

          res.end("Not Found");
          return;
        }

        res.writeHead(200, {
          "Content-Type": getContentType(filePath),
        });

        fs.createReadStream(filePath).pipe(res);
      } catch (error) {
        console.error("Static server error:", error);

        res.writeHead(500);
        res.end("Internal Server Error");
      }
    });

    // Port 0 lets Windows choose a free local port
    localServer.listen(0, "127.0.0.1", () => {
      const address = localServer.address();

      if (
        !address ||
        typeof address === "string"
      ) {
        reject(
          new Error("Unable to determine local server port.")
        );
        return;
      }

      resolve(address.port);
    });

    localServer.on("error", reject);
  });
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,

    show: false,
    autoHideMenuBar: true,

    backgroundColor: "#f7f9fc",

    icon: path.join(
      __dirname,
      "../build/icon.ico"
    ),

    webPreferences: {
      preload: path.join(
        __dirname,
        "preload.cjs"
      ),

      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  require("./ipc/categories.cjs");
  require("./ipc/products.cjs");
  require("./ipc/sales.cjs");
  require("./ipc/orders.cjs");
  require("./ipc/stock.cjs");
  require("./ipc/sales-history.cjs");
  require("./ipc/reports.cjs");
  require("./ipc/backup.cjs");
  require("./ipc/settings.cjs");
  require("./ipc/dashboard.cjs");

  if (isDev) {
    createWindow(
      "http://localhost:3000/dashboard/"
    );
  } else {
    const port = await startLocalServer();

    createWindow(
      `http://127.0.0.1:${port}/dashboard/`
    );
  }

  app.on("activate", async () => {
    if (
      BrowserWindow.getAllWindows().length === 0
    ) {
      if (isDev) {
        createWindow(
          "http://localhost:3000/dashboard/"
        );
      } else {
        let port;

        if (localServer?.listening) {
          const address = localServer.address();

          if (
            address &&
            typeof address !== "string"
          ) {
            port = address.port;
          }
        }

        if (!port) {
          port = await startLocalServer();
        }

        createWindow(
          `http://127.0.0.1:${port}/dashboard/`
        );
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    localServer?.close();
    app.quit();
  }
});