const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;

const logFile = path.join(app.getPath("userData"), "startup.log");

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;

  try {
    fs.appendFileSync(logFile, line);
  } catch {}

  console.log(message);
}

process.on("uncaughtException", (error) => {
  log(`UNCAUGHT EXCEPTION: ${error.stack || error.message}`);
});

process.on("unhandledRejection", (reason) => {
  log(`UNHANDLED REJECTION: ${String(reason)}`);
});

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 960,
    height: 540,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    center: true,
    alwaysOnTop: true,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: "#0F766E",

    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  splashWindow.loadFile(
    path.join(__dirname, "splash.html")
  ).catch((error) => {
    log(`Splash load failed: ${error.stack || error.message}`);
  });

  log("Splash window created");
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
    log("Splash window closed");
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  closeSplash();

  mainWindow.maximize();
  mainWindow.show();
  mainWindow.focus();

  log("Main window shown");
}

function createWindow() {
  log("createWindow started");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,

    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#f7f9fc",

    icon: path.join(__dirname, "../build/icon.ico"),

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  log("BrowserWindow created");

  mainWindow.webContents.on(
    "did-fail-load",
    (
      event,
      errorCode,
      errorDescription,
      validatedURL
    ) => {
      log(
        `did-fail-load: ${errorCode} ${errorDescription} ${validatedURL}`
      );

      showMainWindow();
    }
  );

  mainWindow.webContents.on(
    "render-process-gone",
    (event, details) => {
      log(
        `render-process-gone: ${JSON.stringify(details)}`
      );
    }
  );

  mainWindow.webContents.on(
    "console-message",
    (event, level, message) => {
      log(`Renderer console: ${message}`);
    }
  );

  if (isDev) {
    log("Loading development URL");

    mainWindow
      .loadURL("http://localhost:3000")
      .catch((error) => {
        log(
          `Development load failed: ${
            error.stack || error.message
          }`
        );
      });
  } else {
    const productionPage = path.join(
      __dirname,
      "../out/dashboard/index.html"
    );

    log(`Loading production page: ${productionPage}`);

    mainWindow
      .loadFile(productionPage)
      .catch((error) => {
        log(
          `Production load failed: ${
            error.stack || error.message
          }`
        );

        showMainWindow();
      });
  }

  mainWindow.once("ready-to-show", () => {
    log("ready-to-show fired");
    showMainWindow();
  });

  // Fallback:
  // Prevent the app from running invisibly if ready-to-show
  // does not fire for some reason.
  setTimeout(() => {
    if (
      mainWindow &&
      !mainWindow.isDestroyed() &&
      !mainWindow.isVisible()
    ) {
      log(
        "Main window was still hidden after 3 seconds. Showing fallback window."
      );

      showMainWindow();
    }
  }, 3000);

  mainWindow.on("closed", () => {
    mainWindow = null;
    log("Main window closed");
  });
}

app.whenReady().then(() => {
  log("App ready");

  try {
    require("./ipc/categories.cjs");
    log("categories IPC loaded");

    require("./ipc/products.cjs");
    log("products IPC loaded");

    require("./ipc/sales.cjs");
    log("sales IPC loaded");

    require("./ipc/orders.cjs");
    log("orders IPC loaded");

    require("./ipc/stock.cjs");
    log("stock IPC loaded");

    require("./ipc/sales-history.cjs");
    log("sales-history IPC loaded");

    require("./ipc/reports.cjs");
    log("reports IPC loaded");

    require("./ipc/backup.cjs");
    log("backup IPC loaded");

    require("./ipc/settings.cjs");
    log("settings IPC loaded");

    require("./ipc/dashboard.cjs");
    log("dashboard IPC loaded");
  } catch (error) {
    log(
      `IPC loading failed: ${error.stack || error.message}`
    );
  }

  createSplashWindow();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow();
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});