import Sidebar from "./Sidebar";
export default function AppShell({children}:{children:React.ReactNode}){return <div className="app-shell"><Sidebar/><main className="app-main">{children}</main></div>}
