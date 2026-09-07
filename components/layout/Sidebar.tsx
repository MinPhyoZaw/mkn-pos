
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {LayoutDashboard,ShoppingCart,ClipboardList,Package,Tags,Layers3,History,BarChart3,DatabaseBackup,Settings} from "lucide-react";
const links=[
{href:"/dashboard",label:"Dashboard",icon:LayoutDashboard},
{href:"/sales",label:"New Sale",icon:ShoppingCart},
{href:"/orders",label:"Orders",icon:ClipboardList},
{href:"/products",label:"Products",icon:Package},
{href:"/categories",label:"Categories",icon:Tags},
{href:"/stock",label:"Stock",icon:Layers3},
{href:"/sales-history",label:"Sales History",icon:History},
{href:"/reports",label:"Reports",icon:BarChart3},
{href:"/backup",label:"Backup / Restore",icon:DatabaseBackup},
{href:"/settings",label:"Settings",icon:Settings},
];
export default function Sidebar(){const pathname=usePathname();return <aside style={{width:220,minHeight:"100vh",background:"#fff",borderRight:"1px solid #e8edf5",padding:"18px 14px"}}><div style={{fontWeight:800,fontSize:20,marginBottom:24}}>Toy & Stationery POS</div><nav style={{display:"grid",gap:8}}>{links.map(({href,label,icon:Icon},index)=>{const active=pathname===href||(href!=="/dashboard"&&pathname.startsWith(href));return <Link key={`${href}-${index}`} href={href} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:10,background:active?"#edf4ff":"transparent",color:active?"#1769e0":"#30405f",fontWeight:active?700:500}}><Icon size={18}/>{label}</Link>})}</nav></aside>}
