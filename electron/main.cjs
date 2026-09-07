
const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = !app.isPackaged;
function createWindow(){
  const win=new BrowserWindow({width:1440,height:900,minWidth:1100,minHeight:700,backgroundColor:"#f7f9fc",webPreferences:{preload:path.join(__dirname,"preload.cjs"),contextIsolation:true,nodeIntegration:false}});
  if(isDev){win.loadURL("http://localhost:3000");}else{win.loadFile(path.join(__dirname,"../out/dashboard/index.html"));}
}
app.whenReady().then(()=>{require("./ipc/categories.cjs");require("./ipc/products.cjs");require("./ipc/sales.cjs");require("./ipc/orders.cjs");require("./ipc/dashboard.cjs");createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
